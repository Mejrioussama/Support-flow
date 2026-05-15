import { createRequire } from "module";
import { pathToFileURL } from "url";

const moduleRoot = process.env.CODEX_NODE_MODULES
  || "C:/Users/21655/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const require = createRequire(pathToFileURL(`${moduleRoot}/package.json`));
const pptxgen = require("pptxgenjs");

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "OpenAI Codex";
pptx.company = "SupportFlow";
pptx.subject = "SupportFlow - Soutenance";
pptx.title = "SupportFlow - Presentation Finale";
pptx.lang = "fr-FR";
pptx.theme = {
  headFontFace: "Aptos Display",
  bodyFontFace: "Aptos",
  lang: "fr-FR"
};

const colors = {
  bg: "07111F",
  panel: "0F1D35",
  panelAlt: "0C2747",
  cyan: "38BDF8",
  teal: "2DD4BF",
  gold: "FBBF24",
  red: "FB7185",
  white: "F8FAFC",
  slate: "CBD5E1",
  muted: "94A3B8"
};

function addBackground(slide, accent = colors.cyan) {
  slide.background = { color: colors.bg };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: colors.bg },
    line: { color: colors.bg }
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.4,
    y: 0.4,
    w: 12.53,
    h: 6.7,
    radius: 0.16,
    fill: { color: colors.panel, transparency: 14 },
    line: { color: "163252", transparency: 22, pt: 1.2 }
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 0.65,
    y: 0.72,
    w: 3.4,
    h: 0,
    line: { color: accent, pt: 1.8 }
  });
}

function addHeader(slide, eyebrow, title, subtitle, accent = colors.cyan) {
  addBackground(slide, accent);
  slide.addText(eyebrow, {
    x: 0.72,
    y: 0.72,
    w: 5.2,
    h: 0.3,
    fontSize: 12,
    color: accent,
    bold: true,
    charSpace: 2,
    uppercase: true
  });
  slide.addText(title, {
    x: 0.72,
    y: 1.05,
    w: 8.9,
    h: 0.7,
    fontSize: 24,
    bold: true,
    color: colors.white
  });
  slide.addText(subtitle, {
    x: 0.72,
    y: 1.72,
    w: 9.8,
    h: 0.55,
    fontSize: 11.5,
    color: colors.slate
  });
}

function addBulletList(slide, items, x, y, w, h, fontSize = 18) {
  const runs = [];
  items.forEach((item) => {
    runs.push({
      text: item,
      options: { bullet: { indent: 16 }, breakLine: true }
    });
  });
  slide.addText(runs, {
    x,
    y,
    w,
    h,
    fontSize,
    color: colors.white,
    paraSpaceAfterPt: 10,
    valign: "top"
  });
}

function addMetricCard(slide, x, y, w, h, label, value, accent) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.12,
    fill: { color: colors.panelAlt, transparency: 8 },
    line: { color: accent, transparency: 36, pt: 1.1 }
  });
  slide.addText(label, {
    x: x + 0.18,
    y: y + 0.16,
    w: w - 0.36,
    h: 0.26,
    fontSize: 10.5,
    color: colors.muted,
    bold: true,
    uppercase: true
  });
  slide.addText(value, {
    x: x + 0.18,
    y: y + 0.48,
    w: w - 0.36,
    h: 0.42,
    fontSize: 20,
    color: colors.white,
    bold: true
  });
}

{
  const slide = pptx.addSlide();
  addHeader(
    slide,
    "Projet de stage",
    "SupportFlow",
    "Automatisation du processus de gestion des tickets support client",
    colors.cyan
  );
  slide.addText("Application web de support avec workflow Camunda, SSO Keycloak, GED Alfresco et CI/CD GitOps.", {
    x: 0.72,
    y: 2.35,
    w: 8.9,
    h: 0.7,
    fontSize: 18,
    color: colors.white,
    bold: true
  });
  addMetricCard(slide, 0.72, 3.25, 2.35, 1.15, "Backend", "Spring Boot 3 / Java 17", colors.cyan);
  addMetricCard(slide, 3.25, 3.25, 2.35, 1.15, "Frontend", "Angular 17 + PrimeNG", colors.teal);
  addMetricCard(slide, 5.78, 3.25, 2.35, 1.15, "Workflow", "Camunda BPM", colors.gold);
  addMetricCard(slide, 8.31, 3.25, 2.35, 1.15, "Identite", "Keycloak", colors.red);
  slide.addText("Parcours cible: client cree -> manager assigne -> agent traite -> client valide -> manager archive.", {
    x: 0.72,
    y: 4.85,
    w: 10.3,
    h: 0.45,
    fontSize: 16,
    color: colors.slate
  });
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Contexte", "Problematique et objectifs", "Le projet vise a industrialiser un support client trace, securise et mesurable.", colors.teal);
  addBulletList(slide, [
    "Centraliser la creation, l assignation, le suivi et la cloture des tickets.",
    "Automatiser les transitions critiques via Camunda et des regles SLA metier.",
    "Securiser l acces par roles avec Keycloak et des comptes federes.",
    "Archiver les documents et rapports dans Alfresco avec metadonnees de tracabilite.",
    "Rendre l exploitation demonstrable avec GitHub Actions, ArgoCD, MicroK8s et SonarQube."
  ], 0.9, 2.2, 11.2, 3.8, 17);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Architecture", "Vue d ensemble technique", "Le socle relie le front Angular a des services metier et des integrations externes.", colors.cyan);
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.9, y: 2.1, w: 2.1, h: 1.0, fill: { color: "123055" }, line: { color: colors.cyan, pt: 1 } });
  slide.addText("Angular + PrimeNG\nPWA / WebSocket", { x: 1.08, y: 2.32, w: 1.7, h: 0.5, fontSize: 18, align: "center", color: colors.white, bold: true });
  slide.addShape(pptx.ShapeType.chevron, { x: 3.18, y: 2.42, w: 0.6, h: 0.35, fill: { color: colors.cyan }, line: { color: colors.cyan } });
  slide.addShape(pptx.ShapeType.roundRect, { x: 3.95, y: 2.1, w: 2.45, h: 1.0, fill: { color: "173560" }, line: { color: colors.teal, pt: 1 } });
  slide.addText("Spring Boot\nAPI / SLA / Notifications", { x: 4.18, y: 2.32, w: 2.0, h: 0.5, fontSize: 18, align: "center", color: colors.white, bold: true });
  slide.addShape(pptx.ShapeType.chevron, { x: 6.63, y: 2.42, w: 0.6, h: 0.35, fill: { color: colors.teal }, line: { color: colors.teal } });
  slide.addShape(pptx.ShapeType.roundRect, { x: 7.4, y: 1.55, w: 2.25, h: 0.9, fill: { color: "203E69" }, line: { color: colors.gold, pt: 1 } });
  slide.addText("Camunda BPM", { x: 7.78, y: 1.86, w: 1.45, h: 0.24, fontSize: 18, align: "center", color: colors.white, bold: true });
  slide.addShape(pptx.ShapeType.roundRect, { x: 7.4, y: 2.65, w: 2.25, h: 0.9, fill: { color: "203E69" }, line: { color: colors.red, pt: 1 } });
  slide.addText("Keycloak", { x: 8.02, y: 2.96, w: 1.0, h: 0.24, fontSize: 18, align: "center", color: colors.white, bold: true });
  slide.addShape(pptx.ShapeType.roundRect, { x: 7.4, y: 3.75, w: 2.25, h: 0.9, fill: { color: "203E69" }, line: { color: colors.cyan, pt: 1 } });
  slide.addText("Alfresco GED", { x: 7.8, y: 4.06, w: 1.45, h: 0.24, fontSize: 18, align: "center", color: colors.white, bold: true });
  slide.addShape(pptx.ShapeType.roundRect, { x: 10.05, y: 2.1, w: 2.0, h: 1.0, fill: { color: "123055" }, line: { color: colors.slate, pt: 1 } });
  slide.addText("MySQL\n+ rapports Jasper", { x: 10.32, y: 2.34, w: 1.5, h: 0.42, fontSize: 16, align: "center", color: colors.white, bold: true });
  slide.addText("Le flux complet reste observable via dashboard, notifications, archives et reporting mensuel.", {
    x: 0.9, y: 5.45, w: 11.0, h: 0.4, fontSize: 15, color: colors.slate
  });
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Workflow", "Cycle de vie du ticket", "Le moteur Camunda et les regles metier pilotent les transitions critiques.", colors.gold);
  addBulletList(slide, [
    "Creation du ticket avec priorite et SLA calcules automatiquement.",
    "Assignation manager avec shortlist d agents et charge visible.",
    "Prise en charge agent puis traitement structure.",
    "Mise en attente client avec motif et pause SLA explicite.",
    "Reprise automatique apres reponse client.",
    "Resolution structuree, validation ou refus client, puis cloture et archivage."
  ], 0.9, 2.15, 6.0, 3.7, 17);
  addMetricCard(slide, 7.35, 2.2, 2.25, 1.0, "Statuts cles", "NEW / PENDING / RESOLVED", colors.gold);
  addMetricCard(slide, 9.85, 2.2, 2.25, 1.0, "Historique", "Traçable par evenement", colors.red);
  addMetricCard(slide, 7.35, 3.45, 2.25, 1.0, "Client", "Validation unique", colors.cyan);
  addMetricCard(slide, 9.85, 3.45, 2.25, 1.0, "Manager", "Supervision + arbitrage", colors.teal);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Securite", "Federation Keycloak et gouvernance", "Les comptes applicatifs et les roles sont relies a Keycloak.", colors.red);
  addBulletList(slide, [
    "Connexion SSO avec separation des profils client, agent, manager et admin.",
    "Provisioning des utilisateurs crees depuis l application vers Keycloak.",
    "Reset mot de passe par email avec changement impose au prochain login.",
    "Page utilisateurs avec filtres de role, statut et liaison Keycloak.",
    "Page profil avec preferences et portail securite."
  ], 0.9, 2.2, 6.1, 3.8, 17);
  addMetricCard(slide, 7.45, 2.25, 2.1, 1.05, "Roles", "CLIENT / AGENT / MANAGER / ADMIN", colors.red);
  addMetricCard(slide, 9.8, 2.25, 2.1, 1.05, "Reset", "Mail + rotation mot de passe", colors.gold);
  addMetricCard(slide, 7.45, 3.55, 2.1, 1.05, "Sync", "Migration comptes existants", colors.cyan);
  addMetricCard(slide, 9.8, 3.55, 2.1, 1.05, "Controle", "Permissions backend + UI", colors.teal);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "SLA & supervision", "Pilotage manager et experience support", "Le projet met en avant la supervision metier, pas seulement la gestion CRUD.", colors.teal);
  addBulletList(slide, [
    "Tableau de bord manager avec file d action, charge agent et alertes intelligentes.",
    "Centre notifications avec regroupement, actions directes et mode bulk.",
    "Agent workbench dedie aux tickets a prendre, a reprendre et aux resolutions refusees.",
    "Portail client avec suivi, action attendue et validation claire."
  ], 0.9, 2.1, 6.1, 3.5, 17);
  addMetricCard(slide, 7.35, 2.15, 2.25, 1.0, "SLA metier", "24/7 ou heures ouvrees", colors.teal);
  addMetricCard(slide, 9.85, 2.15, 2.25, 1.0, "Buckets manager", "Sans owner / bloques / risque", colors.gold);
  addMetricCard(slide, 7.35, 3.4, 2.25, 1.0, "Agent", "Workbench priorise", colors.cyan);
  addMetricCard(slide, 9.85, 3.4, 2.25, 1.0, "Client", "Validation et feedback", colors.red);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "GED & reporting", "Alfresco et JasperReports", "Les preuves documentaires et les rapports mensuels font partie du coeur du projet.", colors.cyan);
  addBulletList(slide, [
    "Archivage des tickets fermes et references GED visibles dans l application.",
    "Acces direct aux documents Alfresco et a leur arborescence.",
    "Generation de rapports mensuels PDF / Excel via JasperReports.",
    "Recherche d archives par client, collaborateur, date et gravite."
  ], 0.9, 2.2, 6.0, 3.5, 17);
  addMetricCard(slide, 7.35, 2.2, 2.2, 1.0, "GED", "Alfresco Share", colors.cyan);
  addMetricCard(slide, 9.78, 2.2, 2.2, 1.0, "Report", "PDF + Excel mensuels", colors.gold);
  addMetricCard(slide, 7.35, 3.45, 2.2, 1.0, "Recherche", "client / date / gravite", colors.teal);
  addMetricCard(slide, 9.78, 3.45, 2.2, 1.0, "Traçabilite", "metadonnees archivees", colors.red);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "DevOps", "CI/CD GitOps et qualite", "La chaine de deploiement est alignee avec le sujet et les preuves de qualite.", colors.gold);
  addBulletList(slide, [
    "GitHub Actions: build backend, build frontend, scan securite et analyse SonarQube.",
    "Publication des images sur GHCR avec namespace base sur repository owner.",
    "Mise a jour automatique des overlays Kubernetes puis synchronisation ArgoCD.",
    "Deploiement cible sur MicroK8s.",
    "SonarQube utilise PostgreSQL dedie."
  ], 0.9, 2.15, 6.15, 3.8, 17);
  addMetricCard(slide, 7.35, 2.2, 2.2, 1.0, "Registry", "GHCR", colors.gold);
  addMetricCard(slide, 9.78, 2.2, 2.2, 1.0, "GitOps", "ArgoCD + k8s", colors.cyan);
  addMetricCard(slide, 7.35, 3.45, 2.2, 1.0, "Qualite", "SonarQube", colors.red);
  addMetricCard(slide, 9.78, 3.45, 2.2, 1.0, "Securite", "Trivy", colors.teal);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Demonstration", "Parcours conseille pour le jury", "Sequence courte et lisible pour montrer la valeur metier du projet.", colors.cyan);
  addBulletList(slide, [
    "Client: creation d un ticket avec suggestions KB avant envoi.",
    "Manager: assignation et lecture de la charge / du SLA.",
    "Agent: prise en charge, attente client puis resolution structuree.",
    "Client: validation ou refus de resolution avec feedback.",
    "Manager: archivage, GED Alfresco et rapport mensuel."
  ], 0.9, 2.2, 10.9, 3.7, 17);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Conclusion", "Resultats et perspectives", "SupportFlow couvre l essentiel du sujet avec une experience metier demonstrable.", colors.teal);
  addBulletList(slide, [
    "Le projet relie workflow, securite, GED, reporting et DevOps dans une meme application.",
    "Les parcours client, agent et manager sont coherents et supervisables.",
    "Les livrables de conformite ont ete renforces: PWA, GitOps, SonarQube, guide, Postman, soutenance.",
    "Perspectives: enrichissement KB, regles SLA avancees, tableau de bord encore plus analytique."
  ], 0.9, 2.2, 11.0, 3.6, 17);
  slide.addText("Merci", {
    x: 0.9,
    y: 6.15,
    w: 2.0,
    h: 0.4,
    fontSize: 28,
    bold: true,
    color: colors.white
  });
}

await pptx.writeFile({ fileName: "C:/Users/21655/Desktop/Support-flow/docs/SupportFlow-Soutenance.pptx" });
