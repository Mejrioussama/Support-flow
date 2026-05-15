import unittest

import main
from main import (
    AgentCandidateData,
    AssignmentRecommendationRequest,
    ChatRequest,
    TicketData,
    _answer_supportflow_fact,
    _build_chat_system_context,
    _is_supportflow_question,
    _parse_kv,
    _parse_sections,
    _resolve_assignment_candidate,
    _strip_think,
)


class AIAgentHelpersTest(unittest.TestCase):
    def test_strip_think_removes_reasoning_block(self):
        text = "<think>internal</think>Réponse finale"
        self.assertEqual(_strip_think(text), "Réponse finale")

    def test_parse_kv_extracts_structured_lines(self):
        parsed = _parse_kv("A: 1\nB: test\nTexte libre")
        self.assertEqual(parsed["A"], "1")
        self.assertEqual(parsed["B"], "test")

    def test_supportflow_detection_for_product_question(self):
        self.assertTrue(_is_supportflow_question("Comment fonctionne l'escalade SLA dans SupportFlow ?"))

    def test_supportflow_detection_false_for_general_question(self):
        self.assertFalse(_is_supportflow_question("Explique-moi ce qu'est une adresse IP"))

    def test_chat_context_mentions_general_mode(self):
        req = ChatRequest(message="C'est quoi une adresse IP ?", history=[])
        context = _build_chat_system_context(req)
        self.assertIn("semble générale", context)
        self.assertNotIn("Contexte ticket actif", context)

    def test_chat_context_mentions_supportflow_mode(self):
        req = ChatRequest(message="Quels sont les statuts de ticket dans SupportFlow ?", history=[])
        context = _build_chat_system_context(req)
        self.assertIn("concerne probablement SupportFlow", context)
        self.assertIn("NEW, OPEN, ASSIGNED", context)

    def test_chat_context_prioritizes_ticket_when_present(self):
        ticket = TicketData(
            id=7,
            reference="TCK-007",
            title="VPN inaccessible",
            description="Le client ne peut plus se connecter",
            status="IN_PROGRESS",
            severity="HIGH",
            category="RESEAU",
            escalation_level=1,
            sla_breached=False,
            assigned_agent="Alice Martin",
        )
        req = ChatRequest(message="Que faire maintenant ?", ticket=ticket, history=[])
        context = _build_chat_system_context(req)
        self.assertIn("Contexte ticket actif", context)
        self.assertIn("VPN inaccessible", context)
        self.assertIn("Alice Martin", context)

    def test_supportflow_fact_answer_returns_exact_statuses(self):
        answer = _answer_supportflow_fact("Quels sont les statuts de ticket dans SupportFlow ?")
        self.assertIsNotNone(answer)
        self.assertIn("NEW, OPEN, ASSIGNED, IN_PROGRESS, PENDING, ESCALATED_MANUAL, ESCALATED_SLA, RESOLVED, CLOSED et CANCELLED", answer)

    def test_parse_sections_extracts_multiline_blocks(self):
        parsed = _parse_sections(
            "SUMMARY: Resume\n\nNEXT_ACTIONS:\nAction 1 | Action 2\n\nRISKS:\nRisque 1",
            ["SUMMARY", "NEXT_ACTIONS", "RISKS"],
        )
        self.assertEqual(parsed["SUMMARY"], "Resume")
        self.assertEqual(parsed["NEXT_ACTIONS"], "Action 1 | Action 2")
        self.assertEqual(parsed["RISKS"], "Risque 1")

    def test_resolve_assignment_candidate_matches_id(self):
        candidates = [
            AgentCandidateData(id=2, full_name="Alice Martin"),
            AgentCandidateData(id=5, full_name="Bob Leroy"),
        ]
        selected = _resolve_assignment_candidate("5", candidates)
        self.assertIsNotNone(selected)
        self.assertEqual(selected.id, 5)

    def test_resolve_assignment_candidate_returns_none_on_invalid_value(self):
        candidates = [AgentCandidateData(id=2, full_name="Alice Martin")]
        self.assertIsNone(_resolve_assignment_candidate("abc", candidates))


class FakeResponse:
    def __init__(self, content: str):
        self._content = content

    def raise_for_status(self):
        return None

    def json(self):
        return {"message": {"content": self._content}}


class FakeClient:
    def __init__(self, content: str):
        self.content = content
        self.last_payload = None

    async def post(self, _path, json):
        self.last_payload = json
        return FakeResponse(self.content)


class AIAgentChatEndpointTest(unittest.IsolatedAsyncioTestCase):
    async def asyncTearDown(self):
        main._http_client = None

    async def test_chat_uses_general_context_for_general_question(self):
        fake_client = FakeClient("Une adresse IP identifie un appareil sur un réseau.")
        main._http_client = fake_client

        response = await main.chat(ChatRequest(message="C'est quoi une adresse IP ?", history=[]))

        self.assertEqual(response["answer"], "Une adresse IP identifie un appareil sur un réseau.")
        self.assertIsNone(response["ticket_context"])
        self.assertIn("semble générale", fake_client.last_payload["messages"][0]["content"])

    async def test_chat_uses_ticket_context_when_ticket_is_present(self):
        fake_client = FakeClient("Commencez par vérifier le VPN et les logs d'authentification.")
        main._http_client = fake_client
        ticket = TicketData(id=3, reference="TCK-3", title="VPN HS", status="IN_PROGRESS")

        response = await main.chat(ChatRequest(message="Que faire ?", ticket=ticket, history=[]))

        self.assertEqual(response["ticket_context"], 3)
        self.assertIn("Contexte ticket actif", fake_client.last_payload["messages"][0]["content"])
        self.assertIn("VPN HS", fake_client.last_payload["messages"][0]["content"])

    async def test_chat_returns_deterministic_supportflow_facts(self):
        fake_client = FakeClient("Ne doit pas être utilisé")
        main._http_client = fake_client

        response = await main.chat(ChatRequest(message="Quels sont les statuts de ticket dans SupportFlow ?", history=[]))

        self.assertEqual(response["model"], "supportflow-facts")
        self.assertIn("ESCALATED_SLA", response["answer"])
        self.assertIsNone(fake_client.last_payload)


class AIAgentAssignmentRecommendationTest(unittest.IsolatedAsyncioTestCase):
    async def asyncTearDown(self):
        if hasattr(self, "original_llm"):
            main.llm = self.original_llm

    async def test_assignment_recommendation_uses_valid_ai_choice(self):
        self.original_llm = main.llm

        async def fake_llm(_prompt, system=None, temperature=None):
            return {
                "answer": (
                    "RECOMMENDED_AGENT_ID: 9\n"
                    "RECOMMENDED_AGENT_NAME: Alice Martin\n"
                    "CONFIDENCE: ELEVEE\n"
                    "SKILL_MATCH: Forte experience reseau\n"
                    "RATIONALE: Charge maitrisee et meilleur match competence\n"
                    "MANAGER_VALIDATION_NOTE: Verifier la priorite premium"
                ),
                "model": "test-model",
                "duration_s": 0.12,
            }

        main.llm = fake_llm
        request = AssignmentRecommendationRequest(
            ticket=TicketData(id=42, reference="SF-0042", title="VPN indisponible", category="RESEAU", severity="HIGH"),
            candidates=[
                AgentCandidateData(id=9, full_name="Alice Martin", recommendation_score=0.92, recommendation_reason="Match competence reseau"),
                AgentCandidateData(id=4, full_name="Bob Leroy", recommendation_score=0.81, recommendation_reason="Charge plus forte"),
            ],
        )

        response = await main.assignment_recommendation(request)

        self.assertEqual(response["recommended_agent_id"], 9)
        self.assertEqual(response["recommended_agent_name"], "Alice Martin")
        self.assertEqual(response["confidence"], "ELEVEE")
        self.assertFalse(response["fallback_used"])

    async def test_assignment_recommendation_falls_back_to_top_candidate_when_ai_id_is_invalid(self):
        self.original_llm = main.llm

        async def fake_llm(_prompt, system=None, temperature=None):
            return {
                "answer": (
                    "RECOMMENDED_AGENT_ID: 99\n"
                    "RECOMMENDED_AGENT_NAME: Inconnu\n"
                    "RATIONALE: Mauvais identifiant"
                ),
                "model": "test-model",
                "duration_s": 0.07,
            }

        main.llm = fake_llm
        request = AssignmentRecommendationRequest(
            ticket=TicketData(id=43, reference="SF-0043", title="Erreur ERP", category="LOGICIEL", severity="MEDIUM"),
            candidates=[
                AgentCandidateData(id=3, full_name="Claire Dubois", recommendation_score=0.88, recommendation_reason="Meilleur score global"),
                AgentCandidateData(id=8, full_name="David Morel", recommendation_score=0.64, recommendation_reason="Score inferieur"),
            ],
        )

        response = await main.assignment_recommendation(request)

        self.assertEqual(response["recommended_agent_id"], 3)
        self.assertEqual(response["recommended_agent_name"], "Claire Dubois")
        self.assertTrue(response["fallback_used"])


if __name__ == "__main__":
    unittest.main()
