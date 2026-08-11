import { createRequire } from "module";
import { pathToFileURL } from "url";

const moduleRoot =
  process.env.CODEX_NODE_MODULES ||
  "C:/Users/21655/Desktop/Support-flow/docs/presentation-builder/node_modules";
const require = createRequire(pathToFileURL(`${moduleRoot}/package.json`));
const pptxgen = require("pptxgenjs");

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "OpenAI Codex";
pptx.company = "SupportFlow";
pptx.subject = "Rapport complet du projet SupportFlow";
pptx.title = "SupportFlow - Rapport complet";
pptx.lang = "fr-FR";
pptx.theme = {
  headFontFace: "Aptos Display",
  bodyFontFace: "Aptos",
  lang: "fr-FR",
};

const colors = {
  bg: "07111F",
  panel: "0F1D35",
  panelAlt: "0D2545",
  cyan: "38BDF8",
  teal: "2DD4BF",
  gold: "FBBF24",
  red: "FB7185",
  white: "F8FAFC",
  slate: "CBD5E1",
  muted: "94A3B8",
  violet: "8B5CF6",
};

function addBackground(slide, accent = colors.cyan) {
  slide.background = { color: colors.bg };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: colors.bg },
    line: { color: colors.bg },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.4,
    y: 0.4,
    w: 12.53,
    h: 6.7,
    radius: 0.16,
    fill: { color: colors.panel, transparency: 8 },
    line: { color: "163252", transparency: 24, pt: 1.1 },
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 0.72,
    y: 0.74,
    w: 3.6,
    h: 0,
    line: { color: accent, pt: 1.8 },
  });
}

function addHeader(slide, eyebrow, title, subtitle, accent = colors.cyan) {
  addBackground(slide, accent);
  slide.addText(eyebrow, {
    x: 0.72,
    y: 0.72,
    w: 5,
    h: 0.28,
    fontSize: 11.5,
    color: accent,
    bold: true,
    charSpace: 2,
    uppercase: true,
  });
  slide.addText(title, {
    x: 0.72,
    y: 1.02,
    w: 10.2,
    h: 0.55,
    fontSize: 25,
    bold: true,
    color: colors.white,
  });
  slide.addText(subtitle, {
    x: 0.72,
    y: 1.63,
    w: 10.8,
    h: 0.45,
    fontSize: 11.5,
    color: colors.slate,
  });
}

function addBulletList(slide, items, x, y, w, h, fontSize = 16.5) {
  const runs = [];
  for (const item of items) {
    runs.push({
      text: item,
      options: { bullet: { indent: 15 }, breakLine: true },
    });
  }
  slide.addText(runs, {
    x,
    y,
    w,
    h,
    fontSize,
    color: colors.white,
    paraSpaceAfterPt: 10,
    breakLine: false,
    valign: "top",
  });
}

function addMetricCard(slide, x, y, w, h, label, value, accent) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.11,
    fill: { color: colors.panelAlt, transparency: 5 },
    line: { color: accent, transparency: 35, pt: 1.1 },
  });
  slide.addText(label, {
    x: x + 0.16,
    y: y + 0.14,
    w: w - 0.32,
    h: 0.2,
    fontSize: 10.2,
    color: colors.muted,
    bold: true,
    uppercase: true,
  });
  slide.addText(value, {
    x: x + 0.16,
    y: y + 0.42,
    w: w - 0.32,
    h: h - 0.52,
    fontSize: 18.5,
    color: colors.white,
    bold: true,
    valign: "mid",
  });
}

function addSectionBand(slide, title, x, y, w) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.34,
    rectRadius: 0.08,
    fill: { color: "102641" },
    line: { color: "102641" },
  });
  slide.addText(title, {
    x: x + 0.14,
    y: y + 0.08,
    w: w - 0.28,
    h: 0.16,
    fontSize: 10.5,
    bold: true,
    color: colors.cyan,
    uppercase: true,
    charSpace: 1,
  });
}

{
  const slide = pptx.addSlide();
  addHeader(
    slide,
    "Rapport complet",
    "SupportFlow",
    "Plateforme complete de gestion des tickets support avec workflow, securite, GED, reporting et GitOps.",
    colors.cyan,
  );
  slide.addText(
    "Ce support resume l ensemble du projet: besoin metier, architecture, fonctionnalites, integrations, qualite logicielle et demonstration.",
    {
      x: 0.72,
      y: 2.18,
      w: 10.6,
      h: 0.64,
      fontSize: 17,
      color: colors.white,
      bold: true,
    },
  );
  addMetricCard(slide, 0.72, 3.15, 2.2, 1.1, "Backend", "Spring Boot 3 / Java 17", colors.cyan);
  addMetricCard(slide, 3.08, 3.15, 2.2, 1.1, "Frontend", "Angular 17 + PrimeNG", colors.teal);
  addMetricCard(slide, 5.44, 3.15, 2.2, 1.1, "SSO", "Keycloak", colors.red);
  addMetricCard(slide, 7.8, 3.15, 2.2, 1.1, "Workflow", "Camunda BPM", colors.gold);
  addMetricCard(slide, 10.16, 3.15, 2.2, 1.1, "GED", "Alfresco + JasperReports", colors.violet);
  slide.addText("Auteur: Mejri Oussama | Projet de stage | Support client et supervision metier", {
    x: 0.72,
    y: 5.1,
    w: 8.8,
    h: 0.3,
    fontSize: 12,
    color: colors.slate,
  });
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Vision", "Problematique et objectifs du projet", "SupportFlow repond au besoin de structurer et automatiser le support client.", colors.teal);
  addBulletList(slide, [
    "Centraliser la creation, l assignation, le suivi et la cloture des tickets dans une interface unique.",
    "Rendre les parcours client, agent et manager coherents, lisibles et securises.",
    "Piloter les priorites et les delais de traitement via des regles SLA metier.",
    "Conserver les preuves documentaires, les rapports et l historique des actions.",
    "Industrialiser la livraison applicative avec CI/CD, containers, GitOps et controle qualite."
  ], 0.9, 2.15, 11.4, 4.0);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Perimetre", "Acteurs metier et experiences ciblees", "Le projet couvre quatre profils et un parcours adapte a chacun.", colors.cyan);
  addMetricCard(slide, 0.9, 2.15, 2.65, 1.25, "Client", "Creer un ticket, suivre, repondre, valider ou refuser.", colors.cyan);
  addMetricCard(slide, 3.65, 2.15, 2.65, 1.25, "Agent", "Prendre en charge, collaborer, resoudre, reprendre apres reponse client.", colors.teal);
  addMetricCard(slide, 6.4, 2.15, 2.65, 1.25, "Manager", "Superviser, assigner, arbitrer, piloter le SLA et l equipe.", colors.gold);
  addMetricCard(slide, 9.15, 2.15, 2.25, 1.25, "Admin", "Administrer l application, les utilisateurs et les integrations.", colors.red);
  addBulletList(slide, [
    "Le detail ticket est un ecran commun, mais adapte par role.",
    "Le client dispose d un portail dedie Mes tickets.",
    "L agent dispose d un workbench oriente execution.",
    "Le manager dispose d un dashboard et d une file de supervision."
  ], 0.95, 4.1, 10.9, 2.0, 15.5);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Fonctionnalites", "Modules fonctionnels principaux", "Le projet depasse le simple CRUD ticket et couvre le cycle complet de support.", colors.violet);
  addSectionBand(slide, "Modules coeur", 0.9, 2.1, 5.45);
  addBulletList(slide, [
    "Tickets",
    "Commentaires publics et internes",
    "Clients",
    "Utilisateurs",
    "Notifications temps reel",
    "Profils et preferences",
  ], 0.95, 2.55, 5.2, 2.7, 15.5);
  addSectionBand(slide, "Modules avancees", 6.7, 2.1, 5.55);
  addBulletList(slide, [
    "Dashboard manager",
    "Agent workbench",
    "AI Assistant et base de connaissance",
    "GED Alfresco",
    "Reporting Jasper",
    "PWA / service worker",
  ], 6.75, 2.55, 5.2, 2.7, 15.5);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Architecture", "Vue technique du systeme", "Le front Angular dialogue avec un backend Spring Boot et plusieurs services externes.", colors.cyan);
  addMetricCard(slide, 0.9, 2.25, 2.3, 1.05, "Interface", "Angular 17, PrimeNG, PWA, WebSocket", colors.cyan);
  addMetricCard(slide, 3.45, 2.25, 2.35, 1.05, "Metier", "Spring Boot, JPA, REST, securite JWT", colors.teal);
  addMetricCard(slide, 6.05, 2.25, 2.05, 1.05, "Workflow", "Camunda BPM", colors.gold);
  addMetricCard(slide, 8.35, 2.25, 1.85, 1.05, "SSO", "Keycloak", colors.red);
  addMetricCard(slide, 10.45, 2.25, 1.9, 1.05, "Data", "MySQL", colors.violet);
  addBulletList(slide, [
    "Alfresco gere les documents et les archives du support.",
    "JasperReports produit les rapports mensuels PDF et Excel.",
    "GitHub Actions, GHCR, Kubernetes et ArgoCD automatisent la livraison."
  ], 0.95, 3.8, 11.1, 2.1, 15.5);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Processus", "Cycle de vie du ticket", "Le workflow support est lisible, trace et compatible avec les scenarios metier reels.", colors.gold);
  addBulletList(slide, [
    "Creation du ticket par le client ou le staff avec priorite, client et categorie.",
    "Assignation manager ou prise en charge par un agent selon les permissions.",
    "Passage en traitement, commentaires, pieces jointes et supervision.",
    "Mise en attente client avec motif et reprise automatique apres reponse.",
    "Resolution structuree puis validation, refus ou cloture.",
    "Archivage documentaire et reporting en fin de cycle."
  ], 0.9, 2.15, 6.05, 3.95);
  addMetricCard(slide, 7.4, 2.2, 2.1, 1.0, "Statuts", "NEW / OPEN / IN_PROGRESS / PENDING / RESOLVED / CLOSED", colors.gold);
  addMetricCard(slide, 9.75, 2.2, 2.1, 1.0, "Evenements", "Historique et notifications associes", colors.red);
  addMetricCard(slide, 7.4, 3.45, 2.1, 1.0, "Client", "Validation ou refus motive", colors.cyan);
  addMetricCard(slide, 9.75, 3.45, 2.1, 1.0, "Manager", "Revue, escalade, prolongation SLA", colors.teal);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Parcours metier", "Ce que voit chaque role dans l application", "L UX a ete specialisee par profil pour eviter les actions incoherentes.", colors.teal);
  addSectionBand(slide, "Client", 0.9, 2.1, 3.7);
  addBulletList(slide, [
    "Creation ticket avec suggestions KB",
    "Portail Mes tickets",
    "Suivi de l action attendue",
    "Validation ou refus de resolution",
  ], 0.95, 2.5, 3.45, 2.7, 14.5);
  addSectionBand(slide, "Agent", 4.8, 2.1, 3.7);
  addBulletList(slide, [
    "Workbench a prendre / a reprendre",
    "Traitement et commentaires",
    "Attente client",
    "Resolution structuree",
  ], 4.85, 2.5, 3.45, 2.7, 14.5);
  addSectionBand(slide, "Manager", 8.7, 2.1, 3.6);
  addBulletList(slide, [
    "Dashboard de supervision",
    "Assignation / reequilibrage",
    "Revues et alertes SLA",
    "Vue backlog et notifications",
  ], 8.75, 2.5, 3.3, 2.7, 14.5);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Securite", "Authentication, roles et gouvernance", "La securite n est pas un ajout cosmetique mais un pilier du projet.", colors.red);
  addBulletList(slide, [
    "SSO et federation d identite via Keycloak.",
    "Provisioning des comptes crees dans l application vers Keycloak.",
    "Roles differencies: CLIENT, SUPPORT_AGENT, SUPPORT_MANAGER, ADMIN.",
    "Reset mot de passe par email et rotation imposee au prochain login.",
    "Controles d autorisation au niveau frontend et backend."
  ], 0.9, 2.15, 6.0, 3.7);
  addMetricCard(slide, 7.4, 2.2, 2.15, 1.0, "Comptes demo", "admin / manager / agent1 / client1", colors.red);
  addMetricCard(slide, 9.8, 2.2, 2.15, 1.0, "Securite", "JWT + roles + sync Keycloak", colors.gold);
  addMetricCard(slide, 7.4, 3.45, 2.15, 1.0, "UI", "Actions masquees selon permissions", colors.cyan);
  addMetricCard(slide, 9.8, 3.45, 2.15, 1.0, "Ops", "Page profil + portail securite", colors.teal);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Supervision", "SLA, escalade et pilotage manager", "Le coeur metier du projet est la capacite a superviser un support reel.", colors.gold);
  addBulletList(slide, [
    "SLA metier avec statut operationnel, temps restant, pause et hors horaires.",
    "Escalade manuelle par agent ou manager et escalade automatique sur risque ou depassement SLA.",
    "Logique par niveaux: niveau 1 reassignment, niveau 2 revue manager, niveau 3 takeover.",
    "Declencheurs metier: SLA_AT_RISK, SLA_BREACHED, ASSIGNED_STUCK, MANUAL_MANAGER_REVIEW.",
    "Segments manager: sans owner, attente client, resolution refusee, bloque, risque SLA."
  ], 0.9, 2.15, 6.2, 3.8);
  addMetricCard(slide, 7.45, 2.2, 2.15, 1.0, "SLA", "24/7 ou heures ouvrees", colors.gold);
  addMetricCard(slide, 9.85, 2.2, 2.15, 1.0, "Escalade", "L1 reassignment / L2 revue / L3 takeover", colors.cyan);
  addMetricCard(slide, 7.45, 3.45, 2.15, 1.0, "Manager", "file d action priorisee + alertes", colors.red);
  addMetricCard(slide, 9.85, 3.45, 2.15, 1.0, "Equipe", "charge, backlog, temps reel", colors.teal);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Capitalisation", "IA, base de connaissance, GED et reporting", "Le projet transforme la resolution en patrimoine reutilisable.", colors.violet);
  addBulletList(slide, [
    "AI Assistant pour analyser un ticket, generer un resume operationnel et proposer une reponse.",
    "Suggestions KB pendant la creation du ticket client et pendant le traitement support.",
    "Creation d articles de base de connaissance depuis un ticket resolu.",
    "Resume d escalade et aide contextuelle dans le detail ticket et l assistant IA.",
    "Integration Alfresco Share pour les documents lies et les archives.",
    "Arborescence documentaire visible depuis le detail ticket.",
    "Rapports mensuels JasperReports en PDF et Excel."
  ], 0.9, 2.15, 6.1, 3.8, 14.6);
  addMetricCard(slide, 7.45, 2.2, 2.1, 1.0, "IA", "analyse, resume, suggestion de reponse", colors.violet);
  addMetricCard(slide, 9.8, 2.2, 2.1, 1.0, "KB", "articles lies et suggestions", colors.cyan);
  addMetricCard(slide, 7.45, 3.45, 2.1, 1.0, "GED", "Alfresco Share", colors.gold);
  addMetricCard(slide, 9.8, 3.45, 2.1, 1.0, "Rapports", "Jasper PDF / XLSX", colors.red);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "DevOps", "GitHub Actions, Kubernetes, ArgoCD, SonarQube", "La livraison est automatisee et alignée sur une demarche GitOps.", colors.cyan);
  addBulletList(slide, [
    "GitHub Actions construit le backend et le frontend, lance le scan securite et l analyse SonarQube.",
    "Les images Docker sont poussees vers GHCR.",
    "Les manifests Kubernetes sont versionnes dans le depot.",
    "ArgoCD synchronise le cluster a partir du Git et controle l etat Healthy / Synced.",
    "Le cluster local et les overlays staging / prod permettent une demonstration claire."
  ], 0.9, 2.15, 6.05, 3.85);
  addMetricCard(slide, 7.4, 2.2, 2.15, 1.0, "CI", "Build backend / frontend / scan", colors.cyan);
  addMetricCard(slide, 9.8, 2.2, 2.15, 1.0, "Registry", "GHCR", colors.teal);
  addMetricCard(slide, 7.4, 3.45, 2.15, 1.0, "GitOps", "Kubernetes + ArgoCD", colors.gold);
  addMetricCard(slide, 9.8, 3.45, 2.15, 1.0, "Qualite", "SonarQube + Trivy", colors.red);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Validation", "Ce qui a ete verifie dans le projet", "Le projet a ete teste sur les parcours critiques et sur la chaine technique.", colors.teal);
  addBulletList(slide, [
    "Build backend et build frontend reussis.",
    "Parcours client, agent et manager verifies sur les scenarios principaux.",
    "Reset password, Alfresco Share, Camunda Cockpit et reporting verifies.",
    "Workflow GitHub Actions valide avec build, security scan, SonarQube et push d images.",
    "Cluster local Kubernetes et ArgoCD verifies en mode Synced / Healthy."
  ], 0.9, 2.15, 11.2, 3.8);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Demonstration", "Scenario conseille pour la soutenance", "Un parcours simple permet de montrer rapidement toute la valeur du projet.", colors.gold);
  addBulletList(slide, [
    "1. Le client cree un ticket avec proposition d article KB.",
    "2. Le manager assigne le ticket depuis le detail ou le dashboard.",
    "3. L agent prend en charge, commente, met en attente client puis reprend.",
    "4. L agent produit une resolution structuree.",
    "5. Le client valide ou refuse la resolution.",
    "6. Le manager consulte la supervision, la GED et le rapport mensuel.",
    "7. En parallele, on montre GitHub Actions, SonarQube et ArgoCD."
  ], 0.9, 2.15, 11.0, 4.05);
}

{
  const slide = pptx.addSlide();
  addHeader(slide, "Bilan", "Forces du projet et perspectives", "SupportFlow constitue une base solide, demonstrable et evolutive.", colors.cyan);
  addBulletList(slide, [
    "Couverture fonctionnelle large: tickets, supervision, KB, GED, reporting.",
    "Architecture moderne et outillee: Spring Boot, Angular, Keycloak, Camunda, Alfresco.",
    "Demarche DevOps visible: CI/CD, GHCR, Kubernetes, ArgoCD, SonarQube.",
    "Perspectives possibles: analytics plus fines, SLA avances, autonomie client encore plus forte."
  ], 0.9, 2.15, 11.0, 3.6);
  slide.addText("Merci", {
    x: 0.9,
    y: 6.1,
    w: 2.0,
    h: 0.35,
    fontSize: 28,
    bold: true,
    color: colors.white,
  });
}

await pptx.writeFile({
  fileName: "C:/Users/21655/Desktop/Support-flow/docs/SupportFlow-Rapport-Complet.pptx",
});
