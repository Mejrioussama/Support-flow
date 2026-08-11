# Guide de demarrage - Rapport de stage SupportFlow

## Fichier principal
- Rapport principal : `docs/rapport_stage_supportflow_80p.tex`
- Metadonnees a personnaliser : `docs/report-metadata.tex`
- Chapitres : `docs/sections/`
- Annexes : `docs/sections/annexes/annexes_supportflow.tex`

## Ce qu'il faut remplir en premier
Ouvrir `docs/report-metadata.tex` et remplacer :
- `NomEtudiant`
- `EncadrantAcademique`
- `EncadrantEntreprise`
- `Etablissement`
- `Specialite`
- `EntrepriseAccueil`
- `PeriodeStage`

Puis remplir la fiche :
- `docs/RAPPORT_STAGE_FICHE_INFOS.md`

## Ordre conseille pour commencer la vraie redaction
1. Completer `ch02_entreprise_cadre_stage.tex` avec les informations reelles sur l'entreprise et l'equipe d'accueil.
2. Relire `ch01_introduction_generale.tex` et adapter la problematique a votre contexte exact.
3. Enrichir `ch05_methodologie_conduite_projet.tex` avec vos vraies dates, difficultes et changements d'objectifs.
4. Ajouter vos vraies figures dans `docs/figures/`.
5. Remplacer les emplacements reserves dans les chapitres de conception et de realisation.
6. Utiliser `docs/RAPPORT_STAGE_FICHE_INFOS.md` comme brouillon avant d'injecter le contenu dans le LaTeX.

## Figures conseillees a ajouter
- architecture globale SupportFlow
- diagramme BPMN principal
- capture detail ticket
- capture dashboard manager
- capture Camunda Cockpit
- capture SonarQube
- capture GitHub Actions
- capture ArgoCD / Kubernetes
- capture Alfresco Share

## Compilation
Le script par defaut est :

```powershell
.\docs\build-report.ps1
```

Ou pour un autre fichier :

```powershell
.\docs\build-report.ps1 -FileName rapport_stage_supportflow_80p.tex
```

Si aucun moteur LaTeX n'est installe localement mais que Docker Desktop est disponible :

```powershell
.\docs\build-report.ps1 -UseDocker
```

## Important
La compilation PDF necessite un moteur LaTeX installe localement, par exemple :
- `tectonic`
- ou une distribution TeX avec `pdflatex` / `xelatex`

## Conseils redactionnels
- garder le ton academique et non pas "changelog"
- expliquer les choix et non pas seulement lister les technologies
- mettre le code detaille plutot en annexes
- privilegier les tableaux, schemas et captures dans le corps
- verifier la coherence entre rapport, README, application et soutenance
