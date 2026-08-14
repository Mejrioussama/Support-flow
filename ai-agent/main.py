"""
SupportFlow AI Agent — Microservice Python (FastAPI + Ollama)
Assistant IA pour agents de support et managers.
"""

import os
import re
import json
import time
import asyncio
import logging
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# ─── Config ──────────────────────────────────────────────────────────────────

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
AI_TEMPERATURE = float(os.getenv("AI_TEMPERATURE", "0.3"))
AI_MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "2048"))
AI_NUM_CTX = int(os.getenv("AI_NUM_CTX", "4096"))

SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT", (
    "Tu es SupportFlow AI, un assistant intelligent spécialisé dans le support IT. "
    "Tu analyses les tickets, diagnostiques les problèmes et proposes des solutions. "
    "Réponds toujours en français, de manière structurée, concise et actionnable."
))

# Kept deliberately short: this block is re-processed on every chat turn, and prompt
# evaluation is the dominant cost on CPU-only inference (~16 tok/s). The status, severity
# and role enumerations that used to live here are already served instantly and exactly by
# _answer_supportflow_fact, so carrying them in every prompt cost seconds per message to
# restate what the deterministic path answers better.
SUPPORTFLOW_KNOWLEDGE = """
Connaissance produit SupportFlow:
- Plateforme de gestion de tickets de support IT.
- Rôles: ADMIN, SUPPORT_MANAGER, SUPPORT_AGENT, CLIENT.
- L'assistant IA couvre: analyse et diagnostic de ticket, suggestion de réponse client, résumé d'escalade, tendances, article KB.
- N'affirme rien qui ne soit confirmé par le contexte fourni.
""".strip()

# Models that don't support system role (reasoning models with <think> blocks)
_REASONING_MODELS = {"deepseek-r1", "deepseek-r1:1.5b", "deepseek-r1:7b", "deepseek-r1:8b", "deepseek-r1:14b"}

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("ai-agent")


def _is_reasoning_model() -> bool:
    """Check if the current model is a reasoning model that uses <think> blocks."""
    return OLLAMA_MODEL in _REASONING_MODELS or OLLAMA_MODEL.startswith("deepseek-r1")


def _strip_think(text: str) -> str:
    """Remove <think>...</think> blocks from reasoning model responses.
    If the entire response is inside think tags, extract the think content."""
    if "<think>" not in text:
        return text.strip()
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    if cleaned:
        return cleaned
    inner = re.search(r"<think>(.*?)</think>", text, flags=re.DOTALL)
    if inner:
        return inner.group(1).strip()
    return text.strip()


def _normalize_text(value: str) -> str:
    """Normalize text for lightweight intent detection."""
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def _is_supportflow_question(message: str) -> bool:
    """Detect whether the user is asking about the SupportFlow product/domain."""
    text = _normalize_text(message)
    keywords = (
        "supportflow", "support flow", "ticket", "tickets", "sla", "escalade",
        "escalation", "kb", "base de connaissances", "agent support", "manager support",
        "client", "workflow", "diagnostic", "analyse ticket", "statut", "résolution",
        "resolution", "archive", "rapport", "trend", "tendance"
    )
    return any(keyword in text for keyword in keywords)


def _build_chat_system_context(req: "ChatRequest") -> str:
    """Build a richer system prompt for chat to support general and SupportFlow questions."""
    base = (
        "Tu es SupportFlow AI. Tu réponds toujours en français.\n"
        "Règles:\n"
        "- Si un ticket est fourni, priorise son contexte et propose des actions concrètes.\n"
        "- N'invente rien: si une information manque, dis-le et précise quoi vérifier.\n"
        # Length is the dominant latency factor on CPU-only inference: every extra sentence
        # costs roughly a second of the user's time, so brevity here is a performance rule
        # as much as a style one.
        "- Sois bref: 5 phrases maximum, ou 5 puces courtes. Pas de préambule ni de conclusion.\n\n"
        f"{SUPPORTFLOW_KNOWLEDGE}"
    )

    if req.ticket:
        t = req.ticket
        ticket_context = (
            f"\n\nContexte ticket actif:\n"
            f"- Référence: {t.reference or 'N/A'}\n"
            f"- Titre: {t.title}\n"
            f"- Description: {t.description or 'N/A'}\n"
            f"- Statut: {t.status or 'N/A'}\n"
            f"- Sévérité: {t.severity or 'N/A'}\n"
            f"- Catégorie: {t.category or 'N/A'}\n"
            f"- Escalade: L{t.escalation_level}\n"
            f"- SLA breached: {'OUI' if t.sla_breached else 'NON'}\n"
            f"- Assigné à: {t.assigned_agent or 'Non assigné'}"
        )
        return base + ticket_context

    if _is_supportflow_question(req.message):
        return base + "\n\nLa question de l'utilisateur concerne probablement SupportFlow. Réponds comme expert produit sans inventer."

    return base + "\n\nLa question de l'utilisateur semble générale. Réponds utilement sans forcer un angle SupportFlow."


def _answer_supportflow_fact(message: str) -> str | None:
    """Return deterministic answers for common SupportFlow factual questions."""
    text = _normalize_text(message)

    if ("statut" in text or "status" in text) and "ticket" in text:
        return (
            "Dans SupportFlow, les statuts de ticket connus sont : "
            "NEW, OPEN, ASSIGNED, IN_PROGRESS, PENDING, ESCALATED_MANUAL, "
            "ESCALATED_SLA, RESOLVED, CLOSED et CANCELLED.\n\n"
            "En français : Nouveau, Ouvert, Assigné, En cours, En attente, "
            "Escalade manuelle, Escalade SLA, Résolu, Fermé et Annulé."
        )

    if "rôle" in text or "roles" in text or "role" in text:
        if "supportflow" in text or "support flow" in text or "utilisateur" in text or "user" in text:
            return (
                "Dans SupportFlow, les rôles principaux sont : "
                "ADMIN, SUPPORT_MANAGER, SUPPORT_AGENT et CLIENT.\n\n"
                "En français : Administrateur, Responsable Support, Agent Support et Client."
            )

    if "sévérité" in text or "severite" in text or "severity" in text:
        return (
            "Dans SupportFlow, les niveaux de sévérité connus sont : "
            "SUPER_CRITICAL, CRITICAL, HIGH, MEDIUM et LOW.\n\n"
            "Du plus élevé au plus faible : Super Critique, Critique, Élevée, Moyenne et Faible."
        )

    if "supportflow" in text and ("c'est quoi" in text or "quest ce que" in text or "qu'est ce que" in text or "présente" in text or "presente" in text):
        return (
            "SupportFlow est une plateforme de gestion de tickets de support. "
            "Elle couvre notamment la gestion des tickets, des clients, des utilisateurs, "
            "des archives/rapports et un assistant IA pour l'analyse, le diagnostic et les suggestions."
        )

    if "assistant ia" in text or ("ia" in text and "supportflow" in text):
        return (
            "L'assistant IA de SupportFlow peut aider sur : l'analyse de ticket, "
            "le diagnostic, la suggestion de réponse client, le résumé d'escalade, "
            "l'analyse de tendances et la génération d'article de base de connaissances."
        )

    return None


def _build_messages(prompt: str, system: str | None = None) -> list[dict[str, str]]:
    """Build messages list, handling models that don't support system role."""
    sys_content = system or SYSTEM_PROMPT
    if _is_reasoning_model():
        return [{"role": "user", "content": f"[Instructions: {sys_content}]\n\n{prompt}"}]
    return [
        {"role": "system", "content": sys_content},
        {"role": "user", "content": prompt},
    ]


# ─── Startup: warm up model ──────────────────────────────────────────────────

async def _warmup():
    """Pre-load the model into Ollama memory (runs in background)."""
    log.info("Warming up model %s ...", OLLAMA_MODEL)
    try:
        client = _get_http_client()
        resp = await client.post("/api/chat", json={
            "model": OLLAMA_MODEL,
            "messages": [{"role": "user", "content": "hi"}],
            "stream": False,
            "options": {"num_predict": 1, "num_ctx": 512},
            "keep_alive": "60m",
        })
        resp.raise_for_status()
        log.info("Model %s loaded and ready!", OLLAMA_MODEL)
    except Exception as exc:
        log.warning("Warmup failed (will retry on first request): %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start warmup in background, don't block server startup."""
    task = asyncio.create_task(_warmup())
    yield
    task.cancel()
    if _http_client:
        await _http_client.aclose()


# ─── FastAPI App ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="SupportFlow AI Agent",
    description="Assistant IA pour agents et managers — powered by Ollama",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Ollama Client ───────────────────────────────────────────────────────────

_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(base_url=OLLAMA_HOST, timeout=httpx.Timeout(600.0))
    return _http_client


async def llm(prompt: str, system: str | None = None, temperature: float | None = None,
              max_tokens: int | None = None) -> dict:
    """Appelle Ollama et retourne la réponse + métadonnées.

    max_tokens caps generation for this call only. It is a safety net rather than the main
    speed lever: the model normally stops well before the cap, so what actually controls
    latency is how much output the prompt asks for.
    """
    t0 = time.time()
    try:
        resp = await _get_http_client().post("/api/chat", json={
            "model": OLLAMA_MODEL,
            "messages": _build_messages(prompt, system),
            "stream": False,
            "options": {
                "temperature": temperature or AI_TEMPERATURE,
                "num_predict": max_tokens or AI_MAX_TOKENS,
                "num_ctx": AI_NUM_CTX,
                "num_thread": 4,
            },
            "keep_alive": "60m",
        })
        resp.raise_for_status()
        data = resp.json()
        elapsed = round(time.time() - t0, 2)
        raw_answer = data.get("message", {}).get("content", "")
        answer = _strip_think(raw_answer)
        log.info("LLM response in %ss (%d chars, raw %d)", elapsed, len(answer), len(raw_answer))
        return {"answer": answer, "model": OLLAMA_MODEL, "duration_s": elapsed}
    except Exception as exc:
        log.error("Ollama error: %s", exc)
        raise HTTPException(502, detail=f"Ollama indisponible: {exc}")


# ─── Request / Response Models ───────────────────────────────────────────────

class TicketData(BaseModel):
    id: int
    reference: str = ""
    title: str
    description: str = ""
    type: str = ""
    status: str = ""
    severity: str = ""
    impact: str = ""
    category: str = ""
    escalation_level: int = 0
    escalation_count: int = 0
    sla_breached: bool = False
    assigned_agent: str = ""
    created_at: str = ""
    comments: list[str] = Field(default_factory=list)
    resolution_summary: str = ""


class EscalationEventData(BaseModel):
    from_level: int
    to_level: int
    reason: str
    triggered_by: str
    from_agent: str = ""
    to_agent: str = ""
    was_blocked: bool = False
    timestamp: str = ""


class EscalationSummaryRequest(BaseModel):
    ticket: TicketData
    events: list[EscalationEventData] = Field(default_factory=list)


class TrendMetrics(BaseModel):
    period_days: int = 30
    total_tickets: int = 0
    resolved: int = 0
    sla_breached: int = 0
    escalated: int = 0
    by_severity: dict[str, int] = Field(default_factory=dict)
    by_category: dict[str, int] = Field(default_factory=dict)
    escalation_by_reason: dict[str, int] = Field(default_factory=dict)
    avg_resolution_minutes: float = 0
    satisfaction_avg: float = 0


class ChatRequest(BaseModel):
    message: str
    ticket: Optional[TicketData] = None
    history: list[dict[str, str]] = Field(default_factory=list)


class KBArticle(BaseModel):
    title: str
    summary: str = ""
    content: str = ""


class SuggestResponseRequest(BaseModel):
    ticket: TicketData
    kb_articles: list[KBArticle] = Field(default_factory=list)


class CopilotRequest(BaseModel):
    ticket: TicketData
    kb_articles: list[KBArticle] = Field(default_factory=list)


class AgentCandidateData(BaseModel):
    id: int
    username: str = ""
    full_name: str = ""
    active_tickets: int = 0
    sla_compliance_rate: float = 0.0
    expertise_score: float = 0.0
    recommendation_score: float = 0.0
    recommendation_reason: str = ""


class AssignmentRecommendationRequest(BaseModel):
    ticket: TicketData
    candidates: list[AgentCandidateData] = Field(default_factory=list)


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check."""
    available = False
    models = []
    try:
        resp = await _get_http_client().get("/api/tags")
        resp.raise_for_status()
        tags = resp.json()
        models = [m.get("name", m.get("model", "?")) for m in tags.get("models", [])]
        available = True
    except Exception:
        pass
    return {
        "status": "up",
        "ollama_available": available,
        "model": OLLAMA_MODEL,
        "available_models": models,
        "checked_at": datetime.now().isoformat(),
    }


# ── 1. Analyse / classification de ticket ────────────────────────────────────

@app.post("/analyze")
async def analyze_ticket(ticket: TicketData):
    """Analyse un ticket: catégorie, priorité, tags, complexité, recommandation."""
    prompt = f"""Analyse ce ticket de support IT et fournis une classification structurée.

TICKET:
- Référence: {ticket.reference}
- Titre: {ticket.title}
- Description: {ticket.description or 'Non spécifié'}
- Type actuel: {ticket.type}
- Sévérité actuelle: {ticket.severity}
- Catégorie actuelle: {ticket.category or 'Non classifié'}

Réponds UNIQUEMENT au format suivant (pas de texte supplémentaire):
CATEGORIE_SUGGEREE: [une parmi: RESEAU, SECURITE, LOGICIEL, MATERIEL, COMPTE, BASE_DE_DONNEES, EMAIL, SUPPORT]
PRIORITE_SUGGEREE: [CRITICAL, HIGH, MEDIUM, LOW]
TAGS_SUGGERES: [tag1, tag2, tag3]
COMPLEXITE: [1-5]
TEMPS_ESTIME_MINUTES: [nombre]
RESUME: [résumé en une phrase]
RECOMMANDATION: [action recommandée pour l'agent]"""

    result = await llm(prompt)
    return {
        "ticket_id": ticket.id,
        "ticket_reference": ticket.reference,
        "analysis": _parse_kv(result["answer"]),
        "raw": result["answer"],
        "model": result["model"],
        "duration_s": result["duration_s"],
        "analyzed_at": datetime.now().isoformat(),
    }


# ── 2. Suggestion de réponse ─────────────────────────────────────────────────

@app.post("/suggest-response")
async def suggest_response(req: SuggestResponseRequest):
    """Génère une réponse professionnelle suggérée pour le client."""
    kb_ctx = ""
    if req.kb_articles:
        kb_ctx = "\n\nARTICLES KB PERTINENTS:\n" + "\n".join(
            f"- {a.title}: {a.summary or a.content[:200]}" for a in req.kb_articles[:5]
        )

    comments_ctx = ""
    if req.ticket.comments:
        comments_ctx = "\n\nHISTORIQUE DES ÉCHANGES:\n" + "\n".join(
            f"- {c}" for c in req.ticket.comments[-10:]
        )

    prompt = f"""Tu es un agent de support IT professionnel. Génère une réponse pour le client.

TICKET:
- Référence: {req.ticket.reference}
- Titre: {req.ticket.title}
- Description: {req.ticket.description or 'Non spécifié'}
- Statut: {req.ticket.status}
- Sévérité: {req.ticket.severity}
{comments_ctx}{kb_ctx}

Génère 2 réponses:

REPONSE_COURTE:
[réponse concise et professionnelle, 2-3 phrases]

REPONSE_DETAILLEE:
[réponse complète avec étapes de diagnostic/résolution]"""

    result = await llm(prompt)
    return {
        "ticket_id": req.ticket.id,
        "ticket_reference": req.ticket.reference,
        "suggestions": result["answer"],
        "kb_articles_used": len(req.kb_articles),
        "model": result["model"],
        "duration_s": result["duration_s"],
        "generated_at": datetime.now().isoformat(),
    }


@app.post("/copilot")
async def copilot_ticket(req: CopilotRequest):
    """Generate a compact copilot briefing for an agent working on one ticket."""
    kb_ctx = ""
    if req.kb_articles:
        kb_ctx = "\n\nARTICLES KB PERTINENTS:\n" + "\n".join(
            f"- {a.title}: {a.summary or a.content[:220]}" for a in req.kb_articles[:5]
        )

    comments_ctx = ""
    if req.ticket.comments:
        comments_ctx = "\n\nDERNIERS COMMENTAIRES:\n" + "\n".join(
            f"- {c}" for c in req.ticket.comments[-8:]
        )

    t = req.ticket
    prompt = f"""Tu es le copilot SupportFlow d'un agent support IT.
Analyse ce ticket et produis une aide opérationnelle immédiatement exploitable.

TICKET:
- Référence: {t.reference}
- Titre: {t.title}
- Description: {t.description or 'Non spécifié'}
- Statut: {t.status}
- Sévérité: {t.severity}
- Impact: {t.impact or 'Non spécifié'}
- Catégorie: {t.category or 'Non classifié'}
- Niveau d'escalade: L{t.escalation_level}
- Nombre d'escalades: {t.escalation_count}
- SLA breached: {'OUI' if t.sla_breached else 'NON'}
- Assigné à: {t.assigned_agent or 'Non assigné'}
- Créé le: {t.created_at or 'Non précisé'}
{comments_ctx}{kb_ctx}

Style: télégraphique. Aucune introduction, aucune conclusion, ne répète pas les données du ticket.
Réponds STRICTEMENT avec ces sections et rien d'autre:
SUMMARY:
[2 phrases maximum]

LIKELY_CAUSE:
[1 phrase]

NEXT_ACTIONS:
[3 actions de 8 mots maximum, séparées par " | "]

CUSTOMER_REPLY:
[2 phrases maximum]

RISKS:
[2 risques de 8 mots maximum, séparés par " | "]

KB_HINTS:
[3 mots-clés maximum, séparés par " | "]
"""

    # Generation dominates latency on CPU-only inference (~72% of wall clock), and output
    # length is driven by how much the prompt asks for. The brevity constraints above plus
    # this cap keep the briefing near ~200 tokens instead of the ~415 the verbose template
    # produced, without dropping any of the six sections the UI renders.
    result = await llm(prompt, max_tokens=600)
    parsed = _parse_sections(result["answer"], [
        "SUMMARY",
        "LIKELY_CAUSE",
        "NEXT_ACTIONS",
        "CUSTOMER_REPLY",
        "RISKS",
        "KB_HINTS",
    ])
    return {
        "ticket_id": t.id,
        "ticket_reference": t.reference,
        "copilot": parsed,
        "raw": result["answer"],
        "model": result["model"],
        "duration_s": result["duration_s"],
        "generated_at": datetime.now().isoformat(),
    }


@app.post("/assignment-recommendation")
async def assignment_recommendation(req: AssignmentRecommendationRequest):
    """Recommend one agent from a ranked shortlist for manager validation."""
    if not req.candidates:
        raise HTTPException(400, "Aucun candidat fourni")

    ordered_candidates = sorted(
        req.candidates,
        key=lambda candidate: candidate.recommendation_score,
        reverse=True,
    )[:5]

    candidate_lines = "\n".join(
        (
            f"- ID {candidate.id} | {candidate.full_name or candidate.username or f'Agent {candidate.id}'}"
            f" | charge={candidate.active_tickets}"
            f" | sla={candidate.sla_compliance_rate:.1f}%"
            f" | competence={candidate.expertise_score:.1f}%"
            f" | score={candidate.recommendation_score:.3f}"
            f" | contexte={candidate.recommendation_reason or 'N/A'}"
        )
        for candidate in ordered_candidates
    )

    t = req.ticket
    prompt = f"""Tu aides un manager support a valider une assignation de ticket.
Choisis le meilleur agent parmi la shortlist en combinant:
- adequation competence/categorie
- charge active
- respect SLA
- criticite du ticket

TICKET:
- Reference: {t.reference}
- Titre: {t.title}
- Description: {t.description or 'Non specifie'}
- Statut: {t.status}
- Severite: {t.severity}
- Impact: {t.impact or 'Non specifie'}
- Categorie: {t.category or 'Non classifie'}
- SLA breached: {'OUI' if t.sla_breached else 'NON'}
- Agent actuel: {t.assigned_agent or 'Non assigne'}

SHORTLIST CANDIDATS:
{candidate_lines}

Reponds STRICTEMENT avec ces champs et rien d'autre:
RECOMMENDED_AGENT_ID: [id numerique choisi dans la shortlist]
RECOMMENDED_AGENT_NAME: [nom exact de l'agent]
CONFIDENCE: [FAIBLE|MOYENNE|ELEVEE]
SKILL_MATCH: [pourquoi cet agent correspond au ticket]
RATIONALE: [justification concise de la recommandation]
MANAGER_VALIDATION_NOTE: [ce que le manager doit verifier avant de confirmer]
"""

    result = await llm(prompt, temperature=0.1)
    parsed = _parse_kv(result["answer"])
    selected_candidate = _resolve_assignment_candidate(parsed.get("RECOMMENDED_AGENT_ID"), ordered_candidates)
    fallback_used = selected_candidate is None
    if selected_candidate is None:
        selected_candidate = ordered_candidates[0]

    recommended_name = (
        selected_candidate.full_name or selected_candidate.username
        if fallback_used else parsed.get("RECOMMENDED_AGENT_NAME") or selected_candidate.full_name or selected_candidate.username
    )
    skill_match = parsed.get("SKILL_MATCH") or selected_candidate.recommendation_reason or "Meilleure competence relative sur la shortlist."
    rationale = parsed.get("RATIONALE") or selected_candidate.recommendation_reason or "Selection basee sur la shortlist fournie."

    return {
        "ticket_id": t.id,
        "ticket_reference": t.reference,
        "recommended_agent_id": selected_candidate.id,
        "recommended_agent_name": recommended_name,
        "confidence": parsed.get("CONFIDENCE", "MOYENNE"),
        "skill_match": skill_match,
        "rationale": rationale,
        "manager_validation_note": parsed.get(
            "MANAGER_VALIDATION_NOTE",
            "Verifier la disponibilite reelle et la priorite business avant validation."
        ),
        "fallback_used": fallback_used,
        "raw": result["answer"],
        "model": result["model"],
        "duration_s": result["duration_s"],
        "generated_at": datetime.now().isoformat(),
    }


# ── 3. Résumé d'escalade (manager) ───────────────────────────────────────────

@app.post("/escalation-summary")
async def escalation_summary(req: EscalationSummaryRequest):
    """Résumé décisionnel d'un ticket escaladé pour le manager."""
    timeline = "\n".join(
        f"- {e.timestamp}: L{e.from_level} → L{e.to_level} | {e.reason} | par {e.triggered_by}"
        + (" [BLOQUÉE]" if e.was_blocked else "")
        for e in req.events
    ) or "Aucune escalade enregistrée"

    t = req.ticket
    prompt = f"""En tant que manager IT, analyse cette situation d'escalade et fournis un résumé décisionnel.

TICKET:
- Référence: {t.reference}
- Titre: {t.title}
- Description: {t.description or 'Non spécifié'}
- Statut: {t.status} | Sévérité: {t.severity}
- Niveau escalade: L{t.escalation_level} | Total: {t.escalation_count}
- SLA breached: {'OUI' if t.sla_breached else 'NON'}
- Créé: {t.created_at}
- Assigné à: {t.assigned_agent or 'Non assigné'}

HISTORIQUE D'ESCALADE:
{timeline}

Fournis:
1. RESUME_SITUATION: [2-3 phrases]
2. CAUSE_PROBABLE: [pourquoi tant d'escalades]
3. RISQUE: [FAIBLE/MOYEN/ÉLEVÉ/CRITIQUE] + justification
4. ACTIONS_RECOMMANDEES: [3 actions concrètes]
5. ESTIMATION_RESOLUTION: [temps estimé]"""

    result = await llm(prompt)
    return {
        "ticket_id": t.id,
        "ticket_reference": t.reference,
        "escalation_level": t.escalation_level,
        "escalation_count": t.escalation_count,
        "events_count": len(req.events),
        "summary": result["answer"],
        "model": result["model"],
        "duration_s": result["duration_s"],
        "generated_at": datetime.now().isoformat(),
    }


# ── 4. Diagnostic technique ──────────────────────────────────────────────────

@app.post("/diagnose")
async def diagnose_ticket(ticket: TicketData):
    """Propose un arbre de diagnostic technique."""
    prompt = f"""Tu es un expert en diagnostic IT. Analyse ce problème et propose un arbre de diagnostic.

PROBLEME:
- Titre: {ticket.title}
- Description: {ticket.description or 'Non spécifié'}
- Type: {ticket.type}
- Catégorie: {ticket.category or 'Non classifié'}

Fournis un diagnostic structuré:

1. HYPOTHESES: [3 causes possibles par probabilité]
2. ETAPES_DIAGNOSTIC:
   - Étape 1: [vérification rapide]
   - Étape 2: [test intermédiaire]
   - Étape 3: [analyse approfondie]
3. SOLUTION_PROBABLE: [solution la plus probable]
4. COMMANDES_UTILES: [commandes ou outils si applicable]
5. PREVENTION: [comment éviter ce problème]"""

    result = await llm(prompt)
    return {
        "ticket_id": ticket.id,
        "ticket_reference": ticket.reference,
        "diagnosis": result["answer"],
        "model": result["model"],
        "duration_s": result["duration_s"],
        "generated_at": datetime.now().isoformat(),
    }


# ── 5. Analyse de tendances (manager) ────────────────────────────────────────

@app.post("/trends")
async def analyze_trends(metrics: TrendMetrics):
    """Insights IA sur les tendances du support."""
    total = metrics.total_tickets or 1
    prompt = f"""Analyse ces métriques de support IT des {metrics.period_days} derniers jours et fournis des insights actionnables.

MÉTRIQUES:
- Total tickets: {metrics.total_tickets}
- Résolus: {metrics.resolved} (taux: {metrics.resolved*100/total:.1f}%)
- SLA breached: {metrics.sla_breached} (taux: {metrics.sla_breached*100/total:.1f}%)
- Escaladés: {metrics.escalated} (taux: {metrics.escalated*100/total:.1f}%)
- Temps moyen résolution: {metrics.avg_resolution_minutes:.0f} min
- Satisfaction moyenne: {metrics.satisfaction_avg:.1f}/5
- Par sévérité: {metrics.by_severity}
- Par catégorie: {metrics.by_category}
- Escalades par raison: {metrics.escalation_by_reason}

Fournis:
1. SANTE_SUPPORT: [état global en 2 phrases]
2. TENDANCES: [3 tendances clés]
3. ALERTES: [problèmes nécessitant action immédiate]
4. RECOMMANDATIONS: [3 actions concrètes]
5. PREVISIONS: [si rien ne change]"""

    result = await llm(prompt)
    return {
        "period_days": metrics.period_days,
        "metrics_summary": {
            "total": metrics.total_tickets,
            "resolved": metrics.resolved,
            "breach_rate": round(metrics.sla_breached * 100 / total, 1),
            "escalation_rate": round(metrics.escalated * 100 / total, 1),
        },
        "insights": result["answer"],
        "model": result["model"],
        "duration_s": result["duration_s"],
        "generated_at": datetime.now().isoformat(),
    }


# ── 6. Chat libre ────────────────────────────────────────────────────────────

def _sse(event: str, data: dict) -> str:
    """Format one Server-Sent Event frame.

    ensure_ascii keeps accented French intact through the wire, and the trailing blank
    line is what actually terminates a frame for the browser's parser.
    """
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _build_chat_messages(req: "ChatRequest") -> list[dict[str, str]]:
    """Assemble the message list for a chat turn.

    Shared by /chat and /chat/stream so the streamed answer is produced from exactly the
    same context as the buffered one - the two must not drift apart.
    """
    system_context = _build_chat_system_context(req)
    messages: list[dict[str, str]] = []

    # System prompt natif ou hack selon le modèle
    if _is_reasoning_model():
        # Reasoning models: inject système dans le premier message user uniquement
        for msg in req.history[-20:]:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
        messages.append({"role": "user", "content": f"[Instructions: {system_context}]\n\n{req.message}"})
    else:
        # Standard models: system role natif
        messages.append({"role": "system", "content": system_context})
        for msg in req.history[-20:]:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
        messages.append({"role": "user", "content": req.message})

    return messages


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """Server-Sent Events variant of /chat.

    Generation is ~92% of a chat turn's latency on CPU-only inference while prompt
    evaluation is under a second, so emitting tokens as they are produced puts the first
    words on screen almost immediately instead of after the whole answer is ready. The
    deterministic fact path is still answered in one shot: it is already instant, and
    streaming it would only add complexity.

    Event protocol: `token` carries an incremental chunk, `done` carries the final
    metadata, `error` carries a failure. Every payload is JSON.
    """
    fact_answer = None if req.ticket else _answer_supportflow_fact(req.message)

    async def event_stream():
        if fact_answer:
            yield _sse("token", {"content": fact_answer})
            yield _sse("done", {
                "question": req.message,
                "answer": fact_answer,
                "ticket_context": None,
                "model": "supportflow-facts",
                "duration_s": 0.0,
                "responded_at": datetime.now().isoformat(),
            })
            return

        messages = _build_chat_messages(req)
        t0 = time.time()
        chunks: list[str] = []
        try:
            async with _get_http_client().stream("POST", "/api/chat", json={
                "model": OLLAMA_MODEL,
                "messages": messages,
                "stream": True,
                "options": {"temperature": AI_TEMPERATURE, "num_predict": 400,
                            "num_ctx": AI_NUM_CTX, "num_thread": 4},
                "keep_alive": "60m",
            }) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        payload = json.loads(line)
                    except ValueError:
                        continue
                    piece = payload.get("message", {}).get("content", "")
                    if piece:
                        chunks.append(piece)
                        yield _sse("token", {"content": piece})
                    if payload.get("done"):
                        break
        except Exception as exc:
            log.error("Ollama stream error: %s", exc)
            yield _sse("error", {"detail": f"Ollama indisponible: {exc}"})
            return

        elapsed = round(time.time() - t0, 2)
        # Reasoning models emit <think> blocks that must not reach the user. They are only
        # strippable once the full text is known, so the final answer is re-sent here and
        # the client replaces what it streamed when this differs from the concatenation.
        answer = _strip_think("".join(chunks))
        log.info("Chat stream completed in %ss (%d chars)", elapsed, len(answer))
        yield _sse("done", {
            "question": req.message,
            "answer": answer,
            "ticket_context": req.ticket.id if req.ticket else None,
            "model": OLLAMA_MODEL,
            "duration_s": elapsed,
            "responded_at": datetime.now().isoformat(),
        })

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",  # keeps nginx from buffering the stream into one blob
    })


@app.post("/chat")
async def chat(req: ChatRequest):
    """Conversation libre avec contexte SupportFlow."""
    fact_answer = None if req.ticket else _answer_supportflow_fact(req.message)
    if fact_answer:
        return {
            "question": req.message,
            "answer": fact_answer,
            "ticket_context": None,
            "model": "supportflow-facts",
            "duration_s": 0.0,
            "responded_at": datetime.now().isoformat(),
        }

    messages = _build_chat_messages(req)

    elapsed = 0.0
    t0 = time.time()
    try:
        resp = await _get_http_client().post("/api/chat", json={
            "model": OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
            # A chat turn that runs to the full 2048-token budget costs ~80s on CPU-only
            # inference, which reads as a hang. Capping generation keeps a turn near ~25s;
            # the brevity instruction in the system context is what usually stops it earlier.
            "options": {"temperature": AI_TEMPERATURE, "num_predict": 400, "num_ctx": AI_NUM_CTX, "num_thread": 4},
            "keep_alive": "60m",
        })
        resp.raise_for_status()
        data = resp.json()
        elapsed = round(time.time() - t0, 2)
        raw_answer = data.get("message", {}).get("content", "")
        answer = _strip_think(raw_answer)
    except Exception as exc:
        raise HTTPException(502, detail=f"Ollama indisponible: {exc}")

    log.info("Chat response in %ss (%d chars)", elapsed, len(answer))
    return {
        "question": req.message,
        "answer": answer,
        "ticket_context": req.ticket.id if req.ticket else None,
        "model": OLLAMA_MODEL,
        "duration_s": elapsed,
        "responded_at": datetime.now().isoformat(),
    }


# ── 7. Génération KB article ─────────────────────────────────────────────────

@app.post("/generate-kb-article")
async def generate_kb_article(ticket: TicketData):
    """Génère un brouillon d'article KB à partir d'un ticket résolu."""
    if not ticket.resolution_summary:
        raise HTTPException(400, "Le ticket doit avoir un résumé de résolution")

    prompt = f"""À partir de ce ticket résolu, génère un article de base de connaissances.

TICKET RÉSOLU:
- Titre: {ticket.title}
- Description: {ticket.description}
- Catégorie: {ticket.category or 'Non classifié'}
- Solution: {ticket.resolution_summary}

Génère au format suivant:

TITRE_ARTICLE: [titre clair et recherchable]
RESUME: [résumé en 2-3 phrases]
CATEGORIE: [catégorie KB]
TAGS: [tag1, tag2, tag3]
CONTENU:
[article complet avec: Symptômes, Cause, Solution étape par étape, Prévention]"""

    result = await llm(prompt)
    return {
        "source_ticket_id": ticket.id,
        "source_ticket_reference": ticket.reference,
        "article_draft": result["answer"],
        "parsed": _parse_kv(result["answer"]),
        "model": result["model"],
        "duration_s": result["duration_s"],
        "generated_at": datetime.now().isoformat(),
    }


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_kv(text: str) -> dict[str, str]:
    """Parse les réponses structurées KEY: value."""
    result = {}
    for line in text.split("\n"):
        line = line.strip().lstrip("-*# ")
        if ":" in line:
            k, v = line.split(":", 1)
            k = k.strip()
            v = v.strip()
            if k and v and len(k) < 40:
                result[k] = v
    return result


def _parse_sections(text: str, section_names: list[str]) -> dict[str, str]:
    """Parse multi-line SECTION: blocks into a dictionary."""
    normalized = text.replace("\r\n", "\n")
    lines = normalized.split("\n")
    result: dict[str, str] = {name: "" for name in section_names}
    current: str | None = None

    for raw_line in lines:
        line = raw_line.strip()
        matched_section = next((name for name in section_names if line.startswith(f"{name}:")), None)
        if matched_section:
            current = matched_section
            first_value = line[len(matched_section) + 1:].strip()
            if first_value:
                result[current] = first_value
            continue

        if current and line:
            result[current] = (result[current] + "\n" + line).strip()

    return {key: value.strip() for key, value in result.items() if value.strip()}


def _resolve_assignment_candidate(candidate_id: str | None, candidates: list[AgentCandidateData]) -> AgentCandidateData | None:
    """Match an LLM-selected candidate id to the shortlist."""
    if not candidate_id:
        return None

    try:
        normalized_id = int(str(candidate_id).strip())
    except (TypeError, ValueError):
        return None

    return next((candidate for candidate in candidates if candidate.id == normalized_id), None)


# ─── Main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
