<!DOCTYPE html>
<html class="dark" lang="en">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title><#if realm.displayName??>${realm.displayName}<#else>Register</#if> - SupportFlow</title>
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
                borderRadius: {"DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px"},
              },
            },
          }
    </script>
    <style>
        body {
            background-color: #080e1a;
            background-image: 
                radial-gradient(circle at 2px 2px, rgba(0, 227, 253, 0.15) 1px, transparent 0);
            background-size: 40px 40px;
            overflow-x: hidden;
        }
        .celestial-glow {
            background: radial-gradient(circle at center, rgba(0, 227, 253, 0.08) 0%, transparent 70%);
        }
        .glass-card {
            background: rgba(19, 26, 40, 0.4);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
        }
        .dot-grid-logo {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 4px;
        }
        .dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: #00e3fd;
            box-shadow: 0 0 8px rgba(0, 227, 253, 0.6);
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }

        /* Dynamic Robot Mascot Styles */
        @keyframes floatOrb {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            25% { transform: translateY(-15px) rotate(3deg); }
            50% { transform: translateY(-25px) rotate(0deg); }
            75% { transform: translateY(-10px) rotate(-2deg); }
        }
        @keyframes pulse-glow {
            0%, 92%, 98%, 100% { opacity: 0.8; filter: blur(4px); transform: scaleY(1); }
            50% { opacity: 1; filter: blur(8px); transform: scaleY(1); }
            95%, 99% { opacity: 0.4; filter: blur(2px); transform: scaleY(0.1); }
        }
        @keyframes scanUpDown {
            0% { top: 10%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 90%; opacity: 0; }
        }
        @keyframes flapParts {
            0%, 100% { transform: rotate(12deg) translateY(0); }
            50% { transform: rotate(18deg) translateY(-4px); }
        }
        @keyframes flapPartsOpposite {
            0%, 100% { transform: rotate(-12deg) translateY(0); }
            50% { transform: rotate(-18deg) translateY(-4px); }
        }

        .robot-container { animation: floatOrb 6s ease-in-out infinite; }
        .robot-glow { animation: pulse-glow 4s ease-in-out infinite; }
        .hologram-shield {
            background: linear-gradient(135deg, rgba(0, 227, 253, 0.1), rgba(172, 137, 255, 0.1));
            border: 1px solid rgba(0, 227, 253, 0.3);
            box-shadow: 0 0 20px rgba(0, 227, 253, 0.2);
        }
        .scan-line {
            height: 1px; width: 100%; bg: #00e3fd; background-color: #00e3fd;
            box-shadow: 0 0 8px #00e3fd; position: absolute;
            animation: scanUpDown 3s ease-in-out infinite alternate;
        }
        .flap-left { animation: flapParts 4s ease-in-out infinite; }
        .flap-right { animation: flapPartsOpposite 4s ease-in-out infinite; }
    </style>
</head>
<body class="font-body text-on-surface min-h-screen flex flex-col overflow-x-hidden relative">
    <!-- Atmospheric Background Layers -->
    <div class="fixed inset-0 z-0 celestial-glow pointer-events-none"></div>
    <div class="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px] pointer-events-none"></div>
    <div class="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-tertiary/5 rounded-full blur-[120px] pointer-events-none"></div>
    
    <!-- Header -->
    <header class="fixed top-0 w-full z-50 flex justify-center items-center px-8 py-10">
        <div class="flex items-center gap-3">
            <div class="dot-grid-logo">
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                <div class="dot"></div><div class="dot opacity-40"></div><div class="dot"></div>
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
            </div>
            <span class="text-2xl font-headline font-bold tracking-tighter text-slate-100 drop-shadow-[0_0_8px_rgba(0,227,253,0.4)]">SupportFlow</span>
        </div>
    </header>
    
    <!-- Main Content Canvas -->
    <main class="flex-grow flex items-center justify-center p-6 relative z-10 pt-24 pb-24">
        <!-- Robot Mascot Container -->
        <div class="hidden xl:block absolute left-[calc(50%+24rem)] top-1/2 -translate-y-1/2 robot-container pointer-events-none">
            <div class="relative w-64 h-64 flex items-center justify-center">
                <!-- Robot Head/Body Visualization -->
                <div class="relative z-20 w-32 h-32 bg-surface-container-high rounded-full border border-secondary/30 flex items-center justify-center overflow-hidden shadow-[0_0_30px_rgba(0,227,253,0.1)]">
                    <div class="absolute inset-0 bg-gradient-to-b from-secondary/5 to-transparent"></div>
                    <!-- Eyes -->
                    <div class="flex gap-4">
                        <div class="w-4 h-4 rounded-full bg-secondary robot-glow"></div>
                        <div class="w-4 h-4 rounded-full bg-secondary robot-glow"></div>
                    </div>
                    <!-- Mouth/Comms -->
                    <div class="absolute bottom-6 w-12 h-1 bg-secondary/20 rounded-full overflow-hidden">
                        <div class="w-full h-full bg-secondary opacity-40 animate-pulse"></div>
                    </div>
                </div>
                <!-- Floating Parts -->
                <div class="absolute -left-4 top-1/4 w-8 h-12 bg-surface-container-highest rounded-lg border border-secondary/20 rotate-12 flap-left"></div>
                <div class="absolute -right-4 top-1/4 w-8 h-12 bg-surface-container-highest rounded-lg border border-secondary/20 -rotate-12 flap-right"></div>
                <!-- Holographic Shield/Interface -->
                <div class="absolute -left-16 bottom-0 w-48 h-32 hologram-shield rounded-2xl backdrop-blur-sm z-30 flex flex-col p-4 overflow-hidden">
                    <div class="scan-line"></div>
                    <div class="flex gap-1 mb-2">
                        <div class="w-1 h-1 bg-secondary rounded-full"></div>
                        <div class="w-8 h-1 bg-secondary/30 rounded-full"></div>
                    </div>
                    <div class="space-y-2">
                        <div class="h-1.5 w-full bg-secondary/10 rounded-full"></div>
                        <div class="h-1.5 w-3/4 bg-secondary/10 rounded-full"></div>
                        <div class="h-1.5 w-5/6 bg-secondary/10 rounded-full"></div>
                    </div>
                    <div class="mt-auto flex justify-between items-end">
                        <span class="material-symbols-outlined text-secondary/40 text-lg">monitoring</span>
                        <span class="text-[8px] font-label text-secondary/60 tracking-tighter">SEC_LINK_ACTIVE</span>
                    </div>
                </div>
                <!-- Bottom Propulsion Glow -->
                <div class="absolute bottom-0 w-24 h-8 bg-secondary/20 blur-xl rounded-[100%]"></div>
            </div>
        </div>
        
        <div class="w-full max-w-2xl glass-card rounded-xl border border-outline-variant/15 p-10 md:p-14 shadow-2xl relative">
            <div class="text-center mb-10">
                <h1 class="font-headline text-3xl md:text-4xl font-bold text-primary mb-3">Create an account</h1>
                <p class="text-on-surface-variant text-body-md font-medium">Join the celestial ecosystem and streamline your support flow.</p>
                
                <#if message?has_content && (message.type != 'warning' || !(isAppInitiatedAction??))>
                    <div class="mt-4 p-4 rounded-xl w-full text-center ${(message.type == 'error')?then('bg-error-container/20 text-error border border-error/50', 'bg-secondary/20 text-secondary border border-secondary/50')} text-sm font-medium">
                        <span class="kc-feedback-text">${kcSanitize(message.summary)?no_esc}</span>
                    </div>
                </#if>
            </div>
            
            <form id="kc-register-form" action="${url.registrationAction}" method="post" class="space-y-6">
                <!-- Name Row -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="font-label text-xs uppercase tracking-widest text-on-surface-variant ml-1" for="firstName">First Name</label>
                        <input class="w-full h-14 px-6 bg-surface-container-high rounded-xl border border-outline-variant/10 focus:border-secondary/40 focus:ring-0 text-on-surface transition-all placeholder:text-outline" id="firstName" name="firstName" value="${(register.formData.firstName!'')}" placeholder="Enter first name" type="text" autofocus />
                    </div>
                    <div class="space-y-2">
                        <label class="font-label text-xs uppercase tracking-widest text-on-surface-variant ml-1" for="lastName">Last Name</label>
                        <input class="w-full h-14 px-6 bg-surface-container-high rounded-xl border border-outline-variant/10 focus:border-secondary/40 focus:ring-0 text-on-surface transition-all placeholder:text-outline" id="lastName" name="lastName" value="${(register.formData.lastName!'')}" placeholder="Enter last name" type="text" />
                    </div>
                </div>
                
                <!-- Email & Username Row -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="font-label text-xs uppercase tracking-widest text-on-surface-variant ml-1" for="email">Email</label>
                        <input class="w-full h-14 px-6 bg-surface-container-high rounded-xl border border-outline-variant/10 focus:border-secondary/40 focus:ring-0 text-on-surface transition-all placeholder:text-outline" id="email" name="email" value="${(register.formData.email!'')}" placeholder="name@company.com" type="email" />
                    </div>
                    
                    <#if !realm.registrationEmailAsUsername>
                        <div class="space-y-2">
                            <label class="font-label text-xs uppercase tracking-widest text-on-surface-variant ml-1" for="username">Username</label>
                            <input class="w-full h-14 px-6 bg-surface-container-high rounded-xl border border-outline-variant/10 focus:border-secondary/40 focus:ring-0 text-on-surface transition-all placeholder:text-outline" id="username" name="username" value="${(register.formData.username!'')}" placeholder="Choose a handle" type="text" />
                        </div>
                    <#else>
                        <div class="space-y-2 hidden">
                            <!-- Hidden spacing block to keep grid aligned if needed, though grid auto flow might handle it. But since it's md:grid-cols-2, an empty div is useful to push the next row to a new line, or we can just let it flow. -->
                            <!-- Wait, if username is hidden, the next field (Password) moves into this slot! That would misalign the password inputs. -->
                            <div class="hidden"></div>
                        </div>
                    </#if>
                </div>
                
                <#if passwordRequired??>
                <!-- Password Row -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="font-label text-xs uppercase tracking-widest text-on-surface-variant ml-1" for="password">Password</label>
                        <div class="relative">
                            <input class="w-full h-14 px-6 bg-surface-container-high rounded-xl border border-outline-variant/10 focus:border-secondary/40 focus:ring-0 text-on-surface transition-all placeholder:text-outline" id="password" name="password" placeholder="••••••••" type="password" autocomplete="new-password"/>
                            <span class="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant cursor-pointer hover:text-secondary transition-colors" data-icon="visibility">visibility</span>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <label class="font-label text-xs uppercase tracking-widest text-on-surface-variant ml-1" for="password-confirm">Confirm Password</label>
                        <div class="relative">
                            <input class="w-full h-14 px-6 bg-surface-container-high rounded-xl border border-outline-variant/10 focus:border-secondary/40 focus:ring-0 text-on-surface transition-all placeholder:text-outline" id="password-confirm" name="password-confirm" placeholder="••••••••" type="password" autocomplete="new-password" />
                            <span class="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant cursor-pointer hover:text-secondary transition-colors" data-icon="visibility">visibility</span>
                        </div>
                    </div>
                </div>
                </#if>
                
                <div class="pt-4">
                    <button class="w-full h-14 bg-primary text-on-primary font-headline font-bold text-lg rounded-xl hover:shadow-[0_0_20px_rgba(249,249,249,0.2)] active:scale-[0.98] transition-all duration-200" type="submit">
                        Register
                    </button>
                </div>
            </form>
            
            <div class="mt-10 text-center">
                <a class="inline-flex items-center gap-2 font-label text-xs uppercase tracking-widest text-secondary hover:text-secondary-dim transition-colors group" href="${url.loginUrl}">
                    <span class="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
                    Back to Login
                </a>
            </div>
        </div>
    </main>
    
    <!-- Footer -->
    <footer class="fixed bottom-0 w-full z-10 flex flex-col items-center gap-4 pb-8">
        <div class="flex gap-8">
            <a class="font-label text-[0.6875rem] uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors" href="#">Privacy Policy</a>
            <a class="font-label text-[0.6875rem] uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors" href="#">Terms of Service</a>
            <a class="font-label text-[0.6875rem] uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors" href="#">System Status</a>
        </div>
        <p class="font-label text-[0.6875rem] uppercase tracking-widest text-slate-500 opacity-50">© 2024 SupportFlow Celestial Systems</p>
    </footer>

</body>
</html>
