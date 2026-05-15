# Configuration Java

Le backend SupportFlow utilise `Java 17+`.

## Verification

```powershell
java -version
echo $env:JAVA_HOME
```

## Compilation backend

```powershell
cd C:\Users\21655\Desktop\Support-flow\backend
.\mvnw.cmd -q -DskipTests compile
```

## Si JAVA_HOME est vide

Definir temporairement :

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
```

Puis retester :

```powershell
java -version
.\mvnw.cmd -version
```

## Recommandation

- utiliser `Java 17` ou `Java 21`
- garder `JAVA_HOME` aligne avec la version Java active

