<!DOCTYPE html>
<html class="dark" lang="en">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title><#if realm.displayName??>${realm.displayName}<#else>Sign In</#if> - SupportFlow</title>
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&amp;family=Manrope:wght@300;400;500;600;700;800&amp;display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
    <script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "tertiary": "#ac89ff",
                        "surface": "#080e1a",
                        "on-error-container": "#ffa8a3",
                        "error-container": "#9f0519",
                        "background": "#080e1a",
                        "tertiary-fixed": "#bda1ff",
                        "on-primary-container": "#212323",
                        "primary-fixed-dim": "#dcdddd",
                        "outline-variant": "#424855",
                        "outline": "#707584",
                        "on-tertiary-fixed": "#1f0052",
                        "surface-dim": "#080e1a",
                        "secondary-container": "#006875",
                        "surface-container-highest": "#1e2637",
                        "tertiary-container": "#7000ff",
                        "surface-tint": "#f9f9f9",
                        "surface-container-low": "#0d1320",
                        "on-primary-fixed-variant": "#5f6161",
                        "on-secondary-fixed-variant": "#005964",
                        "secondary-fixed": "#26e6ff",
                        "surface-container-high": "#18202f",
                        "inverse-primary": "#5e5f60",
                        "secondary": "#00e3fd",
                        "primary-dim": "#ebebeb",
                        "on-tertiary-container": "#f8f1ff",
                        "tertiary-fixed-dim": "#b190ff",
                        "on-surface-variant": "#a6abbb",
                        "error-dim": "#d7383b",
                        "tertiary-dim": "#874cff",
                        "primary": "#f9f9f9",
                        "inverse-on-surface": "#4f5563",
                        "error": "#ff716c",
                        "on-secondary-container": "#e8fbff",
                        "surface-bright": "#232c3e",
                        "primary-fixed": "#ebebeb",
                        "primary-container": "#a0a1a1",
                        "inverse-surface": "#f9f9ff",
                        "on-error": "#490006",
                        "on-primary": "#5e5f60",
                        "on-background": "#e0e5f6",
                        "on-surface": "#e0e5f6",
                        "on-secondary": "#004d57",
                        "secondary-dim": "#00d4ec",
                        "on-tertiary-fixed-variant": "#4700a7",
                        "surface-container": "#131a28",
                        "on-primary-fixed": "#434545",
                        "secondary-fixed-dim": "#00d7f0",
                        "surface-container-lowest": "#000000",
                        "on-secondary-fixed": "#003a42",
                        "surface-variant": "#1e2637",
                        "on-tertiary": "#290067"
                    },
                    fontFamily: {
                        "headline": ["Space Grotesk"],
                        "body": ["Manrope"],
                        "label": ["Manrope"]
                    },
                    borderRadius: {"DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px"},
                },
            },
        }
    </script>
    <style>
        body {
            background-color: #080e1a;
            overflow-x: hidden;
        }
        .celestial-bg {
            background: radial-gradient(circle at 50% 50%, #0d1320 0%, #080e1a 100%);
            position: fixed;
            inset: 0;
            z-index: -1;
        }
        .star-field {
            position: absolute;
            inset: 0;
            background-image: 
                radial-gradient(1px 1px at 20px 30px, #e0e5f6, rgba(0,0,0,0)),
                radial-gradient(1.5px 1.5px at 100px 150px, #00e3fd, rgba(0,0,0,0)),
                radial-gradient(1px 1px at 250px 50px, #e0e5f6, rgba(0,0,0,0)),
                radial-gradient(2px 2px at 400px 350px, #00e3fd, rgba(0,0,0,0)),
                radial-gradient(1.5px 1.5px at 550px 200px, #e0e5f6, rgba(0,0,0,0)),
                radial-gradient(1px 1px at 700px 450px, #00e3fd, rgba(0,0,0,0)),
                radial-gradient(2px 2px at 850px 150px, #e0e5f6, rgba(0,0,0,0)),
                radial-gradient(1px 1px at 950px 500px, #00e3fd, rgba(0,0,0,0));
            background-size: 1000px 600px;
            opacity: 0.2;
        }
        .glass-card {
            background: rgba(35, 44, 62, 0.4);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
        }
        .dot-grid-logo {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 4px;
        }
        .dot {
            width: 6px;
            height: 6px;
            background-color: #00e3fd;
            border-radius: 50%;
            box-shadow: 0 0 8px rgba(0, 227, 253, 0.6);
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
        }

        /* Dynamic Robot Styles */
        @keyframes floatDynamic {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            25% { transform: translateY(-15px) rotate(3deg); }
            50% { transform: translateY(-25px) rotate(0deg); }
            75% { transform: translateY(-10px) rotate(-3deg); }
        }
        @keyframes scanSweep {
            0% { transform: translateX(-150%); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateX(150%); opacity: 0; }
        }
        @keyframes blinkEye {
            0%, 92%, 98%, 100% { transform: scaleY(1); opacity: 1; }
            95%, 99% { transform: scaleY(0.1); opacity: 0.5; }
        }
        @keyframes headBob {
            0%, 100% { transform: rotate(0deg) translateY(0); }
            30% { transform: rotate(4deg) translateY(-2px); }
            70% { transform: rotate(-4deg) translateY(2px); }
        }
        @keyframes shadowPulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(0.6); opacity: 0.2; }
        }
        @keyframes hologramWobble {
            0%, 100% { transform: rotate(30deg) skewX(0deg); opacity: 0.3; }
            50% { transform: rotate(32deg) skewX(5deg); opacity: 0.5; }
        }
        
        .robot-container { animation: floatDynamic 6s ease-in-out infinite; }
        .robot-head { animation: headBob 4s ease-in-out infinite; }
        .robot-eye { box-shadow: 0 0 15px #00e3fd; animation: blinkEye 4s infinite; }
        .robot-body { background: linear-gradient(135deg, #1e2637 0%, #0d1320 100%); box-shadow: inset 0 0 20px rgba(0, 227, 253, 0.1); }
        .hologram-beam { background: linear-gradient(to bottom, rgba(0, 227, 253, 0.2) 0%, transparent 100%); clip-path: polygon(50% 0%, 0% 100%, 100% 100%); animation: hologramWobble 4s ease-in-out infinite alternate; }
        .hover-base { animation: shadowPulse 6s ease-in-out infinite; }
        .scanner-beam { animation: scanSweep 1.5s ease-in-out infinite alternate; }
    </style>
</head>
<body class="font-body text-on-surface antialiased min-h-screen flex flex-col justify-center items-center py-20 px-4">
    <!-- Background Layers -->
    <div class="celestial-bg"></div>
    <div class="star-field"></div>
    <div class="fixed inset-0 pointer-events-none opacity-5" data-alt="smooth gradient flowing from deep navy to soft lavender with subtle grain texture"></div>
    
    <!-- Navigation Shell -->
    <header class="fixed top-0 w-full z-50 flex justify-between items-center px-8 py-6">
        <div class="flex items-center gap-3">
            <div class="dot-grid-logo">
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
            </div>
            <span class="text-2xl font-headline font-bold tracking-tighter text-slate-100 drop-shadow-[0_0_8px_rgba(0,227,253,0.4)]">SupportFlow</span>
        </div>
        <div class="flex gap-4">
            <span class="material-symbols-outlined text-cyan-400 cursor-pointer hover:text-cyan-300 transition-colors">help_outline</span>
        </div>
    </header>

    <!-- Main Content Anchor -->
    <main class="w-full max-w-[800px] z-10 flex flex-col md:flex-row items-center justify-center gap-12 mb-24">
        <!-- Futuristic Robot Animation -->
        <div class="hidden lg:block w-64 robot-container relative">
            <!-- Robot Head -->
            <div class="w-32 h-32 robot-body robot-head rounded-2xl border border-white/10 mx-auto relative flex items-center justify-center">
                <!-- Face Panel -->
                <div class="w-24 h-16 bg-black/60 rounded-xl flex items-center justify-center gap-4 border border-secondary/20 overflow-hidden">
                    <div class="w-4 h-4 rounded-full bg-secondary robot-eye"></div>
                    <div class="w-4 h-4 rounded-full bg-secondary robot-eye"></div>
                </div>
                <!-- Antennas -->
                <div class="absolute -top-4 left-1/4 w-1 h-6 bg-outline-variant/50 rounded-full"></div>
                <div class="absolute -top-6 left-1/4 w-3 h-3 bg-secondary rounded-full robot-eye"></div>
            </div>
            <!-- Robot Torso -->
            <div class="w-40 h-24 robot-body rounded-3xl border border-white/10 mx-auto mt-4 relative">
                <div class="absolute inset-x-6 top-4 h-1 bg-secondary/30 rounded-full overflow-hidden">
                    <div class="h-full bg-secondary w-1/3 scanner-beam rounded-full"></div>
                </div>
                <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
                    <div class="w-2 h-2 rounded-full bg-secondary/40"></div>
                    <div class="w-2 h-2 rounded-full bg-secondary"></div>
                    <div class="w-2 h-2 rounded-full bg-secondary/40"></div>
                </div>
            </div>
            <!-- Floating Hover Base -->
            <div class="w-24 h-4 bg-secondary/20 blur-xl mx-auto mt-8 rounded-full hover-base"></div>
            <!-- Interactive Element: Hologram interaction -->
            <div class="absolute -right-12 top-0 hologram-beam w-32 h-64 rotate-[30deg] pointer-events-none opacity-40"></div>
        </div>

        <!-- Sign In Card -->
        <div class="w-full max-w-[480px]">
            <div class="glass-card rounded-xl p-11 border border-outline-variant/15 shadow-[0_40px_80px_rgba(0,0,0,0.4)]">
                <!-- Header Section -->
                <div class="flex flex-col items-center mb-10 text-center">
                    <div class="dot-grid-logo mb-6 scale-125">
                        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                    </div>
                    <h1 class="font-headline text-3xl font-bold tracking-tight text-on-surface mb-2">Sign in to your account</h1>
                    <p class="text-on-surface-variant text-sm font-medium">Access your enterprise dashboard</p>
                    
                    <#if message?has_content && (message.type != 'warning' || !(isAppInitiatedAction??))>
                        <div class="mt-4 p-4 rounded-xl w-full text-center ${(message.type == 'error')?then('bg-error-container/20 text-error border border-error/50', 'bg-secondary/20 text-secondary border border-secondary/50')} text-sm font-medium">
                            <span class="kc-feedback-text">${kcSanitize(message.summary)?no_esc}</span>
                        </div>
                    </#if>
                </div>

                <!-- Form Section -->
                <form id="kc-form-login" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post" class="space-y-6">
                    <!-- Username/Email -->
                    <div class="space-y-2">
                        <label class="text-xs uppercase tracking-widest text-on-surface-variant font-bold px-1" for="username">Username or Email</label>
                        <div class="relative">
                            <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">person</span>
                            <input class="w-full bg-surface-container-high border-0 rounded-xl py-4 pl-12 pr-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-secondary/40 transition-all outline-none" id="username" name="username" value="${(login.username!'')}" placeholder="name@company.com" type="text" autofocus autocomplete="off"/>
                        </div>
                    </div>
                    
                    <!-- Password -->
                    <div class="space-y-2">
                        <label class="text-xs uppercase tracking-widest text-on-surface-variant font-bold px-1" for="password">Password</label>
                        <div class="relative">
                            <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">lock</span>
                            <input class="w-full bg-surface-container-high border-0 rounded-xl py-4 pl-12 pr-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-secondary/40 transition-all outline-none" id="password" name="password" placeholder="••••••••" type="password" autocomplete="off"/>
                        </div>
                    </div>
                    
                    <!-- Utilities -->
                    <div class="flex items-center justify-between px-1">
                        <#if realm.rememberMe>
                        <label class="flex items-center gap-3 cursor-pointer group">
                            <div class="relative flex items-center">
                                <#if login.rememberMe??>
                                    <input class="peer appearance-none w-5 h-5 rounded-lg border-2 border-outline-variant/30 bg-surface-container-high checked:bg-secondary checked:border-secondary transition-all cursor-pointer" id="rememberMe" name="rememberMe" type="checkbox" checked />
                                <#else>
                                    <input class="peer appearance-none w-5 h-5 rounded-lg border-2 border-outline-variant/30 bg-surface-container-high checked:bg-secondary checked:border-secondary transition-all cursor-pointer" id="rememberMe" name="rememberMe" type="checkbox" />
                                </#if>
                                <span class="material-symbols-outlined absolute text-surface-container-lowest text-sm opacity-0 peer-checked:opacity-100 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">check</span>
                            </div>
                            <span class="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">Remember me</span>
                        </label>
                        <#else>
                        <div></div>
                        </#if>
                        
                        <#if realm.resetPasswordAllowed>
                        <a class="text-sm text-secondary hover:text-cyan-300 transition-colors font-medium" href="${url.loginResetCredentialsUrl}">Forgot Password?</a>
                        </#if>
                    </div>
                    
                    <!-- Action -->
                    <button class="w-full bg-primary hover:bg-primary-dim text-on-primary font-bold py-4 rounded-xl shadow-[0_0_15px_rgba(249,249,249,0.1)] active:scale-[0.98] transition-all duration-200 mt-4" name="login" id="kc-login" type="submit">
                        Sign In
                    </button>
                </form>
            </div>
            
            <!-- Footer Link -->
            <#if realm.password && realm.registrationAllowed && !(registrationDisabled??)>
            <div class="mt-8 text-center text-sm">
                <p class="text-on-surface-variant">
                    New user? 
                    <a class="text-secondary font-bold hover:text-cyan-300 transition-colors ml-1" href="${url.registrationUrl}">Register</a>
                </p>
            </div>
            </#if>
        </div>
    </main>

    <!-- Footer Meta -->
    <footer class="fixed bottom-0 w-full z-10 flex flex-col items-center gap-4 pb-8">
        <div class="flex gap-6">
            <a class="text-[0.6875rem] uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors" href="#">Privacy Policy</a>
            <a class="text-[0.6875rem] uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors" href="#">Terms of Service</a>
            <a class="text-[0.6875rem] uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors" href="#">System Status</a>
        </div>
        <span class="text-[0.6875rem] uppercase tracking-widest text-slate-500">© 2024 SupportFlow Celestial Systems</span>
    </footer>

    <!-- Decorative Particle Decoration -->
    <div class="fixed top-1/4 -left-20 w-64 h-64 bg-secondary/5 blur-[100px] rounded-full"></div>
    <div class="fixed bottom-1/4 -right-20 w-80 h-80 bg-tertiary/5 blur-[120px] rounded-full"></div>
</body>
</html>
