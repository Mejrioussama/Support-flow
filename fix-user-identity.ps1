$files = @(
  'backend/src/main/java/com/supportflow/controller/TicketController.java',
  'backend/src/main/java/com/supportflow/controller/CommentController.java',
  'backend/src/main/java/com/supportflow/controller/NotificationController.java',
  'backend/src/main/java/com/supportflow/controller/AttachmentController.java'
)

$ticketPath = $files[0]
$ticket = Get-Content $ticketPath -Raw
if ($ticket -notmatch 'import com\.supportflow\.service\.UserIdentityService;') {
  $ticket = $ticket.Replace("import com.supportflow.service.TicketService;`r`n", "import com.supportflow.service.TicketService;`r`nimport com.supportflow.service.UserIdentityService;`r`n")
}
if ($ticket -notmatch 'private final UserIdentityService userIdentityService;') {
  $ticket = $ticket.Replace("    private final UserRepository userRepository;`r`n", "    private final UserRepository userRepository;`r`n    private final UserIdentityService userIdentityService;`r`n")
}
$ticket = [regex]::Replace($ticket, 'private Long getUserIdFromJwt\(Jwt jwt\) \{[\s\S]*?return newUser\.getId\(\);\s*\}', "private Long getUserIdFromJwt(Jwt jwt) {`r`n        return userIdentityService.resolveUserIdFromJwt(jwt);`r`n    }")
Set-Content $ticketPath $ticket

foreach ($path in $files[1..3]) {
  $content = Get-Content $path -Raw
  if ($content -notmatch 'import com\.supportflow\.service\.UserIdentityService;') {
    $content = $content.Replace("import com.supportflow.service.", "import com.supportflow.service.UserIdentityService;`r`nimport com.supportflow.service.")
  }
  if ($content -notmatch 'private final UserIdentityService userIdentityService;') {
    $content = $content.Replace("    private final UserRepository userRepository;`r`n", "    private final UserRepository userRepository;`r`n    private final UserIdentityService userIdentityService;`r`n")
  }
  $content = [regex]::Replace($content, 'private Long getUserIdFromJwt\(Jwt jwt\) \{[\s\S]*?return newUser\.getId\(\);\s*\}', "private Long getUserIdFromJwt(Jwt jwt) {`r`n        return userIdentityService.resolveUserIdFromJwt(jwt);`r`n    }")
  Set-Content $path $content
}
