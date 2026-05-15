import { Directive, Input, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthService } from '@core/services';

/**
 * Structural directive to conditionally render elements based on user roles.
 *
 * Usage:
 *   <button *hasRole="['ADMIN', 'SUPPORT_MANAGER']">Assigner</button>
 *   <div *hasRole="'ADMIN'">Admin only</div>
 *
 * The element is rendered if the current user has AT LEAST ONE of the required roles.
 */
@Directive({
    selector: '[hasRole]',
    standalone: true
})
export class HasRoleDirective implements OnInit {
    private requiredRoles: string[] = [];
    private hasView = false;

    @Input() set hasRole(roles: string | string[]) {
        this.requiredRoles = Array.isArray(roles) ? roles : [roles];
        this.updateView();
    }

    constructor(
        private templateRef: TemplateRef<any>,
        private viewContainer: ViewContainerRef,
        private authService: AuthService
    ) { }

    ngOnInit(): void {
        this.updateView();
    }

    private updateView(): void {
        const hasAccess = this.requiredRoles.length === 0
            || this.requiredRoles.some(role => this.authService.hasRole(role));

        if (hasAccess && !this.hasView) {
            this.viewContainer.createEmbeddedView(this.templateRef);
            this.hasView = true;
        } else if (!hasAccess && this.hasView) {
            this.viewContainer.clear();
            this.hasView = false;
        }
    }
}
