# Configuration JAVA_HOME pour SupportFlow Backend

## Diagnostic Courant
- ❌ JAVA_HOME non défini dans l'environnement Windows
- ❌ Compilation backend bloquée: `Error: JAVA_HOME not found in your environment`
- ✅ Maven wrapper (`mvnw.cmd`) prêt à compiler
- ✅ Java 17+ requis (compatible avec Spring Boot 3.x)

## Solution: Installer Java et configurer JAVA_HOME

### Option 1: Utiliser JAVA prédéfini (le plus rapide)

Si Java est déjà installé:

```powershell
# Chercher installations Java
Get-ChildItem "C:\Program Files\Java" | Select-Object Name
# Ou
Get-ChildItem "C:\Program Files (x86)\Java" | Select-Object Name
```

**Résultat attendu:** Dossier comme `jdk-17.0.x` ou `jdk-21.0.x`

### Option 2: Définir JAVA_HOME (Windows 10/11)

1. **Identifier le chemin Java:**
   ```
   C:\Program Files\Java\jdk-17.0.x (ou jdk-21.0.x)
   ```

2. **Définir via PowerShell (pour session actuelle):**
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Java\jdk-17.0.1"  # Adapter version
   # Vérifier:
   echo $env:JAVA_HOME
   java -version
   ```

3. **Définir de façon permanente (Windows):**
   - Ouvrir: Settings → System → Advanced system settings
   - Bouton: "Environment Variables"
   - "New" → Ajouter:
     - Variable name: `JAVA_HOME`
     - Variable value: `C:\Program Files\Java\jdk-17.0.1`
   - Redémarrer PowerShell ou Terminal
   - Vérifier: `$env:JAVA_HOME`

### Option 3: Installer Java rapidement

Si Java n'est pas installé, utiliser Chocolatey (Windows package manager):

```powershell
# Si Chocolatey n'est pas installé:
Set-ExecutionPolicy Bypass; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Installer Java 17
choco install jdk17
```

Ou télécharger depuis:
- https://www.oracle.com/java/technologies/downloads/#jdk17-windows
- https://adoptium.net/ (OpenJDK gratuit)

## Test et Validation

```powershell
# Test 1: JAVA_HOME défini
echo $env:JAVA_HOME

# Test 2: Java executable
java -version
# Attendu: "java version" + version number

# Test 3: Maven peut trouver Java
cd c:\Users\21655\Desktop\Support-flow\backend
mvnw.cmd -version
# Attendu: "Apache Maven 3.x" + Java version

# Test 4: Compilation backend
mvnw.cmd -q -DskipTests compile
# Attendu: BUILD SUCCESS
```

## Prochain diagnostic après config JAVA_HOME

Après configuration réussie de JAVA_HOME:

1. **D2 — Diagnostic Camunda:**
   ```bash
   cd backend
   mvnw.cmd clean package -DskipTests
   mvnw.cmd spring-boot:run
   ```

2. **D3/D4 — Tests curl (voir scripts DIAGNOSTIC_D3/D4)**
   - Keycloak token test
   - Camunda instance creation

## Références

- Spring Boot Java compatibility: https://spring.io/projects/spring-boot
- Maven Java: https://maven.apache.org/guides/getting-started/
