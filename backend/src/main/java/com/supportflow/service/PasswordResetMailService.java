package com.supportflow.service;

import com.supportflow.entity.User;
import com.supportflow.exception.BusinessException;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * Envoi des emails de reset de mot de passe.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordResetMailService {

    private final JavaMailSender mailSender;

    @Value("${supportflow.mail.from:no-reply@supportflow.local}")
    private String mailFrom;

    @Value("${supportflow.frontend.base-url:http://localhost:4200}")
    private String frontendBaseUrl;

    @Value("${supportflow.security.portal-url:http://localhost:8180/realms/supportflow/account}")
    private String securityPortalUrl;

    public void sendTemporaryPassword(User user, String temporaryPassword) {
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            throw new BusinessException("Impossible d'envoyer le reset par mail sans adresse email");
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(mailFrom);
            helper.setTo(user.getEmail());
            helper.setSubject("SupportFlow - Reinitialisation de votre mot de passe");
            helper.setText(buildHtmlBody(user, temporaryPassword), true);
            mailSender.send(message);
            log.info("Email de reset mot de passe envoye a {}", user.getEmail());
        } catch (MessagingException | RuntimeException e) {
            throw new BusinessException("Impossible d'envoyer l'email de reset: " + e.getMessage());
        }
    }

    private String buildHtmlBody(User user, String temporaryPassword) {
        String fullName = user.getFullName() != null ? user.getFullName() : user.getUsername();
        return """
            <html>
              <body style="font-family:Arial,sans-serif;background:#07101f;color:#e8eefb;padding:24px;">
                <div style="max-width:640px;margin:0 auto;background:#0d1b32;border:1px solid rgba(96,165,250,.25);border-radius:18px;padding:28px;">
                  <p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#8fdcff;margin:0 0 12px;">SupportFlow</p>
                  <h1 style="margin:0 0 12px;font-size:28px;line-height:1.1;">Reinitialisation de votre mot de passe</h1>
                  <p style="margin:0 0 18px;color:#c7d3ea;line-height:1.6;">Bonjour %s,<br><br>
                  Un administrateur ou manager SupportFlow a demande un reset de votre acces.</p>

                  <div style="background:#071322;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:18px;margin:18px 0;">
                    <p style="margin:0 0 8px;color:#8fdcff;font-size:12px;letter-spacing:.12em;text-transform:uppercase;">Mot de passe temporaire</p>
                    <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:.06em;">%s</p>
                  </div>

                  <p style="margin:0 0 12px;color:#c7d3ea;line-height:1.6;">
                    Ce mot de passe est temporaire. Keycloak vous demandera d'en definir un nouveau lors de votre prochaine connexion.
                  </p>

                  <div style="margin:22px 0 14px;">
                    <a href="%s" style="display:inline-block;background:#54d4ff;color:#03111d;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:700;margin-right:10px;">Ouvrir SupportFlow</a>
                    <a href="%s" style="display:inline-block;background:#112445;color:#e8eefb;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:700;">Portail securite Keycloak</a>
                  </div>

                  <p style="margin:18px 0 0;color:#93a1bb;line-height:1.6;font-size:13px;">
                    Si vous n'etiez pas a l'origine de cette demande, contactez rapidement votre administrateur SupportFlow.
                  </p>
                </div>
              </body>
            </html>
            """.formatted(fullName, temporaryPassword, frontendBaseUrl, securityPortalUrl);
    }
}
