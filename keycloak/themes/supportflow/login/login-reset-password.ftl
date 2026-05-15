<!DOCTYPE html>
<html class="dark" lang="en">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title><#if realm.displayName??>${realm.displayName}<#else>Forgot Password</#if> - SupportFlow</title>
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&amp;family=Manrope:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>
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
                borderRadius: {"DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "2xl": "1.5rem", "full": "9999px"},
                animation: {
                  'float': 'float 6s ease-in-out infinite',
                  'scan': 'scan 3s ease-in-out infinite alternate',
                  'blink': 'blink 4s infinite'
                },
                keyframes: {
                  float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                  },
                  scan: {
                    '0%': { transform: 'translateY(-10px)', opacity: '0.2' },
                    '100%': { transform: 'translateY(10px)', opacity: '0.8' },
                  },
                  blink: {
                    '0%, 90%, 100%': { transform: 'scaleY(1)' },
                    '95%': { transform: 'scaleY(0.1)' },
                  }
                }
              },
            },
          }
    </script>
    <style>
        body {
            background-color: #080e1a;
            font-family: 'Manrope', sans-serif;
            color: #e0e5f6;
            margin: 0;
            overflow-x: hidden;
        }
        .celestial-bg {
            background: radial-gradient(circle at 50% 50%, #0d1320 0%, #080e1a 100%);
            position: fixed;
            inset: 0;
            z-index: -1;
        }
        .stars {
            background-image: 
                radial-gradient(1px 1px at 20px 30px, #eee, rgba(0,0,0,0)),
                radial-gradient(1.5px 1.5px at 40px 70px, #fff, rgba(0,0,0,0)),
                radial-gradient(1px 1px at 90px 40px, #fff, rgba(0,0,0,0)),
                radial-gradient(2px 2px at 160px 120px, #00e3fd, rgba(0,0,0,0));
            background-repeat: repeat;
            background-size: 200px 200px;
            opacity: 0.15;
            position: absolute;
            inset: 0;
        }
        .nebula {
            position: absolute;
            width: 100%;
            height: 100%;
            background: radial-gradient(60% 60% at 50% 50%, rgba(0, 227, 253, 0.05) 0%, transparent 100%);
            filter: blur(80px);
        }
        .glass-card {
            background: rgba(35, 44, 62, 0.4);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(66, 72, 85, 0.15);
        }
        .glow-cyan {
            box-shadow: 0 0 15px rgba(0, 227, 253, 0.4);
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        /* Robot Styling */
        .robot-head {
            background: linear-gradient(135deg, #1e2637 0%, #0d1320 100%);
            border: 1px solid rgba(0, 227, 253, 0.3);
        }
        .scanning-beam {
            background: linear-gradient(transparent, #00e3fd, transparent);
            filter: blur(2px);
        }
    </style>
</head>
<body class="flex items-center justify-center min-h-screen">
    <div class="celestial-bg">
        <div class="stars"></div>
        <div class="nebula"></div>
    </div>
    
    <header class="fixed top-0 w-full z-50 flex justify-between items-center px-8 py-6">
        <div class="flex items-center gap-3">
            <div class="grid grid-cols-3 gap-1">
                <div class="w-1.5 h-1.5 rounded-full bg-secondary glow-cyan"></div>
                <div class="w-1.5 h-1.5 rounded-full bg-secondary glow-cyan"></div>
                <div class="w-1.5 h-1.5 rounded-full bg-secondary glow-cyan opacity-40"></div>
                <div class="w-1.5 h-1.5 rounded-full bg-secondary glow-cyan"></div>
                <div class="w-1.5 h-1.5 rounded-full bg-secondary glow-cyan opacity-60"></div>
                <div class="w-1.5 h-1.5 rounded-full bg-secondary glow-cyan"></div>
            </div>
            <span class="text-2xl font-bold tracking-tighter text-slate-100 drop-shadow-[0_0_8px_rgba(0,227,253,0.4)] font-headline">SupportFlow</span>
        </div>
    </header>
    
    <main class="w-full max-w-lg px-6 z-20 mt-12 mb-24">
        <div class="glass-card rounded-2xl p-10 md:p-14 text-center relative">
            <!-- Animated Robot Assistant -->
            <div class="flex justify-center -mt-24 mb-10">
                <div class="relative animate-float">
                    <!-- Robot Head -->
                    <div class="w-24 h-24 robot-head rounded-3xl relative overflow-hidden flex flex-col items-center justify-center border-b-4 border-secondary/20">
                        <!-- Scanning Beam -->
                        <div class="absolute inset-x-0 h-4 scanning-beam animate-scan z-10"></div>
                        <!-- Eyes Container -->
                        <div class="flex gap-4 mb-2">
                            <div class="w-3 h-3 bg-secondary rounded-full glow-cyan animate-blink"></div>
                            <div class="w-3 h-3 bg-secondary rounded-full glow-cyan animate-blink"></div>
                        </div>
                        <!-- Thinking Mouth/Indicator -->
                        <div class="w-8 h-1 bg-secondary/30 rounded-full relative">
                            <div class="absolute inset-0 bg-secondary glow-cyan rounded-full animate-pulse"></div>
                        </div>
                    </div>
                    <!-- Robot Neck/Base -->
                    <div class="w-12 h-4 bg-surface-container-high mx-auto -mt-1 rounded-b-lg border-x border-b border-outline-variant/20"></div>
                    <!-- Floating Orbs -->
                    <div class="absolute -left-6 top-1/2 w-4 h-4 bg-secondary/20 rounded-full blur-sm"></div>
                    <div class="absolute -right-8 top-1/4 w-6 h-6 bg-secondary/10 rounded-full blur-md animate-pulse"></div>
                </div>
            </div>
            
            <h1 class="font-headline text-3xl md:text-4xl font-bold text-on-surface mb-4 tracking-tight">Forgot Your Password?</h1>
            <p class="font-body text-on-surface-variant text-sm md:text-base leading-relaxed mb-10">
                Enter your username or email address and we will send you instructions on how to create a new password.
            </p>
            
            <#if message?has_content && (message.type != 'warning' || !(isAppInitiatedAction??))>
                <div class="mb-4 p-4 rounded-xl w-full text-center ${(message.type == 'error')?then('bg-error-container/20 text-error border border-error/50', 'bg-secondary/20 text-secondary border border-secondary/50')} text-sm font-medium">
                    <span class="kc-feedback-text">${kcSanitize(message.summary)?no_esc}</span>
                </div>
            </#if>

            <form class="space-y-6 text-left" action="${url.loginAction}" method="post">
                <div class="space-y-2">
                    <label class="font-label text-xs uppercase tracking-widest text-on-surface-variant ml-1" for="username">Username or Email</label>
                    <div class="relative">
                        <input class="w-full bg-surface-container-high border-0 focus:ring-1 focus:ring-secondary/40 text-on-surface placeholder:text-on-surface-variant/30 rounded-2xl px-6 py-4 transition-all duration-300" id="username" name="username" placeholder="e.g. commander@orbit.flow" type="text" autofocus value="${(auth.attemptedUsername!'')}" />
                        <div class="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/20">
                            <span class="material-symbols-outlined" data-icon="alternate_email">alternate_email</span>
                        </div>
                    </div>
                </div>
                
                <button class="w-full py-4 px-6 bg-gradient-to-r from-primary to-primary-dim text-on-primary font-bold rounded-2xl hover:shadow-[0_0_20px_rgba(249,249,249,0.2)] active:scale-95 transition-all duration-200" type="submit">
                    Submit
                </button>
            </form>
            
            <div class="mt-10 flex flex-col items-center gap-6">
                <a class="group flex items-center gap-2 text-secondary hover:text-secondary-fixed transition-colors text-sm font-medium" href="${url.loginUrl}">
                    <span class="material-symbols-outlined text-lg">arrow_back</span>
                    <span>Back to Login</span>
                </a>
            </div>
        </div>
    </main>
    
    <footer class="fixed bottom-0 w-full z-10 flex flex-col items-center gap-4 pb-8">
        <div class="flex gap-6">
            <a class="font-label text-[0.6875rem] uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors" href="#">Privacy Policy</a>
            <a class="font-label text-[0.6875rem] uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors" href="#">Terms of Service</a>
            <a class="font-label text-[0.6875rem] uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors" href="#">System Status</a>
        </div>
        <p class="font-label text-[0.6875rem] uppercase tracking-widest text-slate-500">© 2024 SupportFlow Celestial Systems</p>
    </footer>
</body>
</html>
