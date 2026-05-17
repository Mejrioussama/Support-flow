import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { KeycloakService } from 'keycloak-angular';
import { Subscription } from 'rxjs';
import * as THREE from 'three';
import { environment } from '@env/environment';

import { HeaderComponent } from './layout/header/header.component';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { WebSocketService, NotificationService } from '@core/services';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    SidebarComponent,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  template: `
    @if (!initialized) {
      <div class="loading-screen">
        @if (!safeVisualMode) {
          <div #loaderCanvas class="three-canvas"></div>
        }
        <div class="loading-content glass-panel" [class.safe-mode]="safeVisualMode">
          <h1 class="neon-text">SupportFlow</h1>
          <div class="glow-spinner"></div>
          <p>Initialisation du système...</p>
        </div>
      </div>
    } @else if (isLoggedIn) {
      <div class="app-container">
        <!-- Persistent 3D Background -->
        <div class="animated-bg">
          <div class="gradient-sphere sphere-1"></div>
          <div class="gradient-sphere sphere-2"></div>
        </div>

        <app-sidebar 
          [collapsed]="sidebarCollapsed" 
          (toggleCollapse)="sidebarCollapsed = $event">
        </app-sidebar>
        
        <div class="main-content" [class.sidebar-collapsed]="sidebarCollapsed">
          <app-header 
            [collapsed]="sidebarCollapsed"
            (toggleSidebar)="sidebarCollapsed = !sidebarCollapsed">
          </app-header>
          
          <main class="content-area">
            <router-outlet></router-outlet>
          </main>
        </div>
      </div>
    } @else {
      <div class="login-container">
        @if (!safeVisualMode) {
          <div #loginCanvas class="three-canvas"></div>
        }
        
        <div class="login-card glass-panel highlight-border" [class.safe-mode]="safeVisualMode">
          <div class="logo-wrapper">
            <mat-icon class="neon-icon">blur_on</mat-icon>
            <h1 class="neon-title">SupportFlow</h1>
          </div>
          <p class="subtitle">Portail d'Assistance 3.0</p>
          
          <div class="login-buttons">
            <button mat-raised-button class="neon-btn" (click)="login()">
              <mat-icon>fingerprint</mat-icon>
              Authentification
            </button>
            
            <button mat-button class="glass-btn secondary-btn" (click)="register()">
              <mat-icon>person_add</mat-icon>
              Créer un compte
            </button>
          </div>
          
          <div class="forgot-password">
            <a href="javascript:void(0)" (click)="forgotPassword()" class="link-hover">
              Récupération de compte
            </a>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* 3D Canvas Backgrounds */
    .three-canvas {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: 0;
      pointer-events: none;
    }

    /* Animated CSS Spheres for logged-in bg */
    .animated-bg {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      overflow: hidden;
      z-index: 0;
      pointer-events: none;
    }
    
    .gradient-sphere {
      position: absolute;
      border-radius: 50%;
      filter: blur(100px);
      opacity: 0.3;
      animation: floatAppBg 25s infinite alternate ease-in-out;
      transform-style: preserve-3d;
    }

    .sphere-1 {
      width: 600px; height: 600px;
      background: radial-gradient(circle, var(--accent-blue), transparent 70%);
      top: -200px; right: -200px;
    }

    .sphere-2 {
      width: 700px; height: 700px;
      background: radial-gradient(circle, var(--accent-purple), transparent 70%);
      bottom: -300px; left: -200px;
      animation-delay: -10s;
    }

    @keyframes floatAppBg {
      0% { transform: translate3d(0, 0, 0) scale(1); }
      50% { transform: translate3d(-100px, 150px, 0) scale(1.2); }
      100% { transform: translate3d(50px, -100px, 0) scale(0.8); }
    }

    /* Loading Screen */
    .loading-screen {
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
      background: var(--bg-dark);
      overflow: hidden;
      
      .loading-content {
        position: relative;
        z-index: 2;
        padding: 40px 60px;
        text-align: center;
        border-radius: 24px;
        box-shadow: 0 0 50px rgba(59, 130, 246, 0.2);
        background: rgba(7, 9, 19, 0.82);
        border: 1px solid rgba(59, 130, 246, 0.18);

        &.safe-mode {
          min-width: 340px;
          backdrop-filter: none !important;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
        }
        
        .neon-text {
          font-size: 36px;
          font-weight: 800;
          margin-bottom: 30px;
          background: linear-gradient(135deg, var(--text-main) 0%, var(--accent-blue) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        p {
          margin-top: 24px;
          color: var(--neon-cyan);
          letter-spacing: 2px;
          font-size: 14px;
          text-transform: uppercase;
        }
      }

      .glow-spinner {
        width: 60px; height: 60px;
        margin: 0 auto;
        border: 4px solid transparent;
        border-top-color: var(--neon-cyan);
        border-right-color: var(--accent-purple);
        border-radius: 50%;
        animation: glowSpin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
        box-shadow: 0 0 20px rgba(6, 182, 212, 0.4);
      }
    }
    
    @keyframes glowSpin {
      0% { transform: rotate(0deg); filter: hue-rotate(0deg); }
      100% { transform: rotate(360deg); filter: hue-rotate(360deg); }
    }
    
    /* Login Screen */
    .login-container {
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: var(--bg-dark);
      position: relative;
      overflow: hidden;
    }
    
    .login-card {
      position: relative;
      z-index: 2;
      padding: 50px;
      border-radius: 24px;
      text-align: center;
      min-width: 420px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.2) inset !important;
      backdrop-filter: blur(20px) !important;
      animation: floatCard 6s ease-in-out infinite;
      background: rgba(7, 9, 19, 0.86);
      border: 1px solid rgba(59, 130, 246, 0.22);

      &.safe-mode {
        animation: none;
        min-width: 360px;
        backdrop-filter: none !important;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45) !important;
      }

      .logo-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        margin-bottom: 12px;

        .neon-icon {
          font-size: 64px;
          width: 64px; height: 64px;
          color: var(--neon-cyan);
          filter: drop-shadow(0 0 12px rgba(6, 182, 212, 0.6));
        }
      }
      
      .neon-title {
        margin: 0;
        font-size: 38px;
        font-weight: 800;
        background: linear-gradient(135deg, var(--text-main) 0%, var(--accent-purple) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      
      .subtitle {
        margin: 0 0 40px;
        color: var(--text-muted);
        font-size: 16px;
        letter-spacing: 1px;
      }
      
      .login-buttons {
        display: flex;
        flex-direction: column;
        gap: 16px;
        
        button {
          width: 100%;
          height: 48px !important;
          font-size: 16px !important;
          border-radius: 12px !important;
          display: flex;
          justify-content: center;
          align-items: center;
          
          mat-icon {
            margin-right: 12px;
          }
        }
      }

      .secondary-btn {
        background: var(--glass-bg) !important;
        border: 1px solid var(--glass-border) !important;
        color: var(--text-main) !important;
        &:hover {
          background: var(--glass-bg-hover) !important;
          border-color: var(--glass-highlight) !important;
        }
      }
      
      .forgot-password {
        margin-top: 32px;
        
        .link-hover {
          color: var(--text-muted);
          text-decoration: none;
          font-size: 14px;
          transition: 0.3s;
          
          &:hover {
            color: var(--neon-cyan);
            text-shadow: 0 0 8px rgba(6, 182, 212, 0.4);
          }
        }
      }
    }

    @keyframes floatCard {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }
    
    ::ng-deep .mat-mdc-snack-bar-container {
      background: transparent !important;
      box-shadow: none !important;

      .mdc-snackbar__surface {
        background: var(--glass-bg) !important;
        backdrop-filter: blur(12px) !important;
        border: 1px solid var(--glass-border);
        border-radius: 12px !important;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
      }
      
      .mdc-snackbar__label {
        color: var(--text-main) !important;
        font-family: 'Inter', sans-serif;
      }

      .mat-mdc-button {
        color: var(--neon-cyan) !important;
      }
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  isLoggedIn = false;
  sidebarCollapsed = false;
  initialized = false;
  safeVisualMode = false;
  private router = inject(Router);
  private toastSub: Subscription | null = null;

  @ViewChild('loaderCanvas') loaderCanvasRef!: ElementRef;
  @ViewChild('loginCanvas') loginCanvasRef!: ElementRef;

  // Three.js instances
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private particlesMesh!: THREE.Points;
  private animationFrameId: number | null = null;
  private isHoveringCard = false;
  private themeObserver: MutationObserver | null = null;
  private mouseX = 0;
  private mouseY = 0;

  constructor(
    private keycloak: KeycloakService,
    private wsService: WebSocketService,
    private notificationService: NotificationService,
    private snackBar: MatSnackBar
  ) {
    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', this.onMouseMove.bind(this));
      this.setupThemeObserver();
    }
  }

  private setupThemeObserver() {
    this.themeObserver = new MutationObserver(() => {
      this.updateThreeJsTheme();
    });
    this.themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  private updateThreeJsTheme() {
    if (!this.scene) return;
    const isLightMode = document.body.classList.contains('light-theme');
    const sceneBgColor = isLightMode ? '#f0f4f8' : '#070913';
    const color = new THREE.Color(sceneBgColor);
    
    this.scene.background = color;
    if (this.scene.fog) {
      (this.scene.fog as THREE.FogExp2).color = color;
      (this.scene.fog as THREE.FogExp2).density = isLightMode ? 0.002 : 0.001;
    }
  }

  async ngOnInit() {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      this.safeVisualMode = window.location.port === '30088' || window.location.port === '30086';
      if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
      } else {
        document.body.classList.remove('light-theme');
      }
    }

    try {
      this.isLoggedIn = await this.keycloak.isLoggedIn();
    } catch (error) {
      if (!environment.production) {
        console.warn('Keycloak check failed:', error);
      }
      this.isLoggedIn = false;
    }
    this.initialized = true;

    if (this.isLoggedIn) {
      this.wsService.connect();
      this.notificationService.init();

      this.toastSub = this.notificationService.getToastMessages().subscribe(toast => {
        this.snackBar.open(`${toast.title}: ${toast.message}`, 'OK', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['toast-' + toast.type]
        });
      });
      
      // Auto-redirect from empty route to dashboard (AuthGuard will handle role-specific routing)
      if (typeof window !== 'undefined' && window.location.pathname === '/') {
         this.router.navigate(['/dashboard']);
      }
    }
  }

  ngAfterViewInit() {
    // Initialize 3D depending on what is shown
    setTimeout(() => {
      if (this.safeVisualMode) {
        return;
      }
      if (!this.initialized && this.loaderCanvasRef) {
        this.initThreeJs(this.loaderCanvasRef.nativeElement, true);
      } else if (!this.isLoggedIn && this.loginCanvasRef) {
        this.initThreeJs(this.loginCanvasRef.nativeElement, false);
      }
    }, 100);
  }

  ngOnDestroy(): void {
    this.toastSub?.unsubscribe();
    this.wsService.disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', this.onMouseMove.bind(this));
      this.themeObserver?.disconnect();
    }
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    // Cleanup ThreeJS
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  // --- 3D Background Implementation ---

  private onMouseMove(event: MouseEvent) {
    this.mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

    // Check if hovering over center card logic could be added here if needed
  }

  private initThreeJs(container: HTMLElement, isLoader: boolean) {
    // Basic Setup
    this.scene = new THREE.Scene();
    
    // Check theme to dynamically set space colors
    const isLightMode = typeof document !== 'undefined' ? document.body.classList.contains('light-theme') : false;
    const sceneBgColor = isLightMode ? '#f0f4f8' : '#070913';
    
    // Use app dark/light background color
    this.scene.background = new THREE.Color(sceneBgColor);
    // Add some fog for depth
    this.scene.fog = new THREE.FogExp2(sceneBgColor, isLightMode ? 0.002 : 0.001);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.z = 30;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // Create Particles System
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = isLoader ? 2000 : 4000;

    const posArray = new Float32Array(particlesCount * 3);
    const colorsArray = new Float32Array(particlesCount * 3);

    const color1 = new THREE.Color('#3b82f6'); // Azure
    const color2 = new THREE.Color('#8b5cf6'); // Purple
    const color3 = new THREE.Color('#06b6d4'); // Cyan

    for (let i = 0; i < particlesCount * 3; i += 3) {
      // Position - spread out in a galaxy/cloud shape
      posArray[i] = (Math.random() - 0.5) * 100;
      posArray[i + 1] = (Math.random() - 0.5) * 100;
      // Z depth
      posArray[i + 2] = (Math.random() - 0.5) * 100;

      // Color mixing
      const mixedColor = color1.clone();
      const rand = Math.random();
      if (rand > 0.66) {
        mixedColor.lerp(color2, Math.random());
      } else if (rand > 0.33) {
        mixedColor.lerp(color3, Math.random());
      }

      colorsArray[i] = mixedColor.r;
      colorsArray[i + 1] = mixedColor.g;
      colorsArray[i + 2] = mixedColor.b;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));

    // Material with additive blending for glowing effect
    const particlesMaterial = new THREE.PointsMaterial({
      size: isLoader ? 0.3 : 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    this.particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    this.scene.add(this.particlesMesh);

    // Constantly rotate
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);

      // Slow rotation
      this.particlesMesh.rotation.y += 0.001;
      this.particlesMesh.rotation.x += 0.0005;

      // Parallax effect based on mouse movement
      if (!isLoader) {
        const targetX = this.mouseX * 0.5;
        const targetY = this.mouseY * 0.5;

        this.camera.position.x += (targetX - this.camera.position.x) * 0.05;
        this.camera.position.y += (targetY - this.camera.position.y) * 0.05;
        this.camera.lookAt(this.scene.position);
      }

      this.renderer.render(this.scene, this.camera);
    };

    // Handle Window Resize
    const onWindowResize = () => {
      if (this.camera && this.renderer) {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('resize', onWindowResize);

    animate();
  }

  // --- Auth Actions ---

  async login(): Promise<void> {
    try {
      await this.ensureKeycloakReady();
      await this.keycloak.login({
        redirectUri: `${window.location.origin}${this.router.url}`
      });
      return;
    } catch (error) {
      if (!environment.production) {
        console.warn('Keycloak adapter login failed.', error);
      }
    }
    this.snackBar.open('Connexion impossible pour le moment. Recharge la page puis réessaie.', 'OK', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }

  async register(): Promise<void> {
    try {
      await this.ensureKeycloakReady();
      await this.keycloak.login({
        action: 'register',
        redirectUri: window.location.origin
      });
      return;
    } catch (error) {
      if (!environment.production) {
        console.warn('Keycloak adapter register failed.', error);
      }
    }
    this.snackBar.open('Inscription indisponible pour le moment. Recharge la page puis réessaie.', 'OK', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }

  forgotPassword() {
    const keycloakUrl = environment.keycloak.url;
    const realm = environment.keycloak.realm;
    const clientId = environment.keycloak.clientId;
    const redirectUri = encodeURIComponent(window.location.origin);

    window.location.href = `${keycloakUrl}/realms/${realm}/login-actions/reset-credentials?client_id=${clientId}&redirect_uri=${redirectUri}`;
  }

  private async ensureKeycloakReady(): Promise<void> {
    const instance = this.keycloak.getKeycloakInstance() as any;
    if (instance?.didInitialize) {
      return;
    }

    await this.keycloak.init({
      config: {
        url: environment.keycloak.url,
        realm: environment.keycloak.realm,
        clientId: environment.keycloak.clientId
      },
      initOptions: {
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: window.location.origin + '/assets/silent-check-sso.html',
        checkLoginIframe: false,
        pkceMethod: 'S256'
      },
      enableBearerInterceptor: true,
      bearerPrefix: 'Bearer',
      bearerExcludedUrls: ['/assets'],
      loadUserProfileAtStartUp: false
    });
  }
}
