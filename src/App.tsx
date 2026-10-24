import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  FileText, 
  Crosshair, 
  Briefcase, 
  Eye, 
  CheckCircle2, 
  Coins, 
  ShoppingBag, 
  Shield, 
  Target, 
  Zap,
  Sparkles,
  ChevronRight,
  Power
} from 'lucide-react';
import { OfficeGame, GamePhase } from './game/officeGame';
import { EmployeeProfile } from './game/npcData';
import { InteractiveProp } from './game/physicsWorld';
import { SHOP_WEAPONS, ShopWeaponDef } from './game/weaponsCatalog';
import { soundEngine } from './game/audioEngine';

interface GameOverData {
  won: boolean;
  reason: string;
  victim?: EmployeeProfile;
  murderer?: EmployeeProfile;
  secretWeapon?: string;
  motive?: string;
  phase: number;
  coinsEarned?: number;
  totalKillers?: number;
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<OfficeGame | null>(null);

  // Campaign State (15 escalations)
  const [currentPhase, setCurrentPhase] = useState<number>(1);
  const [coins, setCoins] = useState<number>(() => {
    const saved = localStorage.getItem('office_coins');
    return saved !== null ? parseInt(saved, 10) : 25; // 25 initial coins to try equipment early
  });
  const [unlockedWeapons, setUnlockedWeapons] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('office_unlocked_weapons');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [equippedWeaponId, setEquippedWeaponId] = useState<string | null>(() => {
    return localStorage.getItem('office_equipped_weapon') || null;
  });

  // Game Run State
  const [phase, setPhase] = useState<GamePhase>('TITLE');
  const [secondsLeft, setSecondsLeft] = useState<number>(120);
  const [currentRoom, setCurrentRoom] = useState<string>('Gabinete do CEO');
  const [hoverProp, setHoverProp] = useState<string | null>(null);
  const [hoverEmployee, setHoverEmployee] = useState<EmployeeProfile | null>(null);
  const [heldProp, setHeldProp] = useState<InteractiveProp | null>(null);
  const [throwCharge, setThrowCharge] = useState<number>(0);
  const [gameOverResult, setGameOverResult] = useState<GameOverData | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isBlackout, setIsBlackout] = useState<boolean>(false);

  // Modals & Banners
  const [showDossierModal, setShowDossierModal] = useState<boolean>(false);
  const [showShopModal, setShowShopModal] = useState<boolean>(false);
  const [showPhaseBriefing, setShowPhaseBriefing] = useState<boolean>(false);
  const [eliminationBanner, setEliminationBanner] = useState<{
    text: string;
    subtext: string;
  } | null>(null);

  const [remainingKillersCount, setRemainingKillersCount] = useState<number>(1);
  const [totalKillersCount, setTotalKillersCount] = useState<number>(1);

  // Save persistent economy to localStorage
  useEffect(() => {
    localStorage.setItem('office_coins', coins.toString());
  }, [coins]);

  useEffect(() => {
    localStorage.setItem('office_unlocked_weapons', JSON.stringify(unlockedWeapons));
  }, [unlockedWeapons]);

  useEffect(() => {
    if (equippedWeaponId) {
      localStorage.setItem('office_equipped_weapon', equippedWeaponId);
    } else {
      localStorage.removeItem('office_equipped_weapon');
    }
  }, [equippedWeaponId]);

  useEffect(() => {
    if (!mountRef.current) return;

    const game = new OfficeGame(mountRef.current, {
      onPhaseChange: (newPhase) => setPhase(newPhase),
      onTimeUpdate: (sec) => setSecondsLeft(sec),
      onHoverProp: (propName) => setHoverProp(propName),
      onHoverEmployee: (emp) => setHoverEmployee(emp),
      onHeldPropChange: (prop) => setHeldProp(prop),
      onRoomChange: (room) => setCurrentRoom(room),
      onChargeUpdate: (charge) => setThrowCharge(charge),
      onBlackoutChange: (blackout) => setIsBlackout(blackout),
      onKillerEliminated: (status) => {
        setRemainingKillersCount(status.remaining);
        setTotalKillersCount(status.total);
        setEliminationBanner({
          text: `🎯 INFILTRADO NEUTRALIZADO!`,
          subtext: `${status.killerName} (${status.killerRole}) eliminado! Restam ${status.remaining} de ${status.total} assassino(s).`
        });
        setTimeout(() => setEliminationBanner(null), 4000);
      },
      onGameOver: (result) => {
        setGameOverResult(result);
        if (result.won && result.coinsEarned) {
          setCoins(prev => prev + result.coinsEarned!);
        }
      },
    });

    gameRef.current = game;

    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  const getEquippedWeaponDef = (): ShopWeaponDef | undefined => {
    return SHOP_WEAPONS.find(w => w.id === equippedWeaponId);
  };

  const startPhaseMatch = (phaseNum: number) => {
    setShowPhaseBriefing(false);
    setShowShopModal(false);
    setShowDossierModal(false);
    setEliminationBanner(null);
    setIsBlackout(false);

    const weaponToEquip = getEquippedWeaponDef();
    setRemainingKillersCount(phaseNum);
    setTotalKillersCount(phaseNum);

    if (gameRef.current) {
      gameRef.current.startNewGame(phaseNum, weaponToEquip);
    }
  };

  const handleNextPhase = () => {
    if (currentPhase < 15) {
      const nextP = currentPhase + 1;
      setCurrentPhase(nextP);
      setShowPhaseBriefing(true);
    } else {
      // Completed All 15 Phases of Campaign!
      setCurrentPhase(1);
      setShowPhaseBriefing(true);
    }
  };

  const handleRestartCampaign = () => {
    // Loss resets back to Phase 1, but keeps coins and weapons
    setCurrentPhase(1);
    startPhaseMatch(1);
  };

  const handleBuyWeapon = (weapon: ShopWeaponDef) => {
    if (coins < weapon.cost) return;
    setCoins(prev => prev - weapon.cost);
    setUnlockedWeapons(prev => [...prev, weapon.id]);
    setEquippedWeaponId(weapon.id);
    soundEngine.playCoinSound();

    // If currently in game, equip in real-time
    if (gameRef.current && phase === 'PLAYING') {
      gameRef.current.equipShopWeapon(weapon);
    }
  };

  const handleEquipWeapon = (weapon: ShopWeaponDef) => {
    if (equippedWeaponId === weapon.id) {
      setEquippedWeaponId(null);
    } else {
      setEquippedWeaponId(weapon.id);
      if (gameRef.current && phase === 'PLAYING') {
        gameRef.current.equipShopWeapon(weapon);
      }
    }
  };

  const handleToggleMute = () => {
    if (gameRef.current) {
      const muted = gameRef.current.toggleMute();
      setIsMuted(muted);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none text-slate-100">
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 z-0 cursor-crosshair" />

      {/* =========================================================================
          HUD OVERLAY: ACTIVE DURING PLAYING
          ========================================================================= */}
      {phase === 'PLAYING' && (
        <>
          {/* Top Bar: Room location, Phase/Target Info, Countdown Clock, Coins */}
          <header className="absolute top-3 left-3 right-3 sm:top-5 sm:left-6 sm:right-6 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
            {/* Left: Location & Phase Escalation Badge */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-lg text-xs font-medium">
                <Briefcase className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Sala:</span>
                <span className="text-amber-300 font-bold truncate max-w-[140px] sm:max-w-none">{currentRoom}</span>
              </div>

              {/* Phase Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/90 border border-indigo-700 shadow-lg text-xs font-bold text-indigo-300">
                <Target className="w-3.5 h-3.5 text-indigo-400" />
                <span>Fase {currentPhase}/15</span>
                <span className="text-amber-400 font-black">({remainingKillersCount} Alvo{remainingKillersCount > 1 ? 's' : ''})</span>
              </div>
            </div>

            {/* Center: Countdown Suspense Clock */}
            <div className={`flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-2.5 rounded-2xl border shadow-2xl font-mono text-lg sm:text-2xl font-black tracking-widest tabular-nums ${
              secondsLeft <= 30
                ? 'bg-red-950/95 border-red-500 text-red-400 animate-pulse'
                : 'bg-slate-900/95 border-slate-700 text-amber-400'
            }`}>
              <Clock className="w-5 h-5 text-red-400 shrink-0" />
              <span>{formatTime(secondsLeft)}</span>
            </div>

            {/* Right: Coins Counter & Controls */}
            <div className="flex items-center gap-2">
              {/* Coin Badge */}
              <button
                onClick={() => setShowShopModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-amber-500/10 border border-amber-500/50 hover:bg-amber-500/20 text-amber-300 font-bold text-xs transition-colors shadow-lg cursor-pointer"
                title="Abrir Loja de Armas"
              >
                <Coins className="w-4 h-4 text-amber-400" />
                <span>{coins}</span>
                <ShoppingBag className="w-3.5 h-3.5 ml-1 text-amber-400" />
              </button>

              <button
                onClick={() => setShowDossierModal(!showDossierModal)}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-900/90 border border-slate-700 hover:bg-slate-800 text-slate-200 font-bold text-xs transition-colors shadow-lg cursor-pointer"
                title="Ver lista de funcionários da empresa"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Dossiê RH</span>
              </button>

              <button
                onClick={handleToggleMute}
                className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors shadow-lg cursor-pointer"
                title={isMuted ? 'Ativar Som' : 'Desativar Som'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>
          </header>

          {/* Elimination Progress Notification Banner */}
          {eliminationBanner && (
            <div className="absolute top-18 sm:top-22 left-1/2 -translate-x-1/2 z-30 max-w-md w-11/12 animate-in slide-in-from-top duration-300 pointer-events-none">
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-3 sm:p-4 rounded-2xl border-2 border-emerald-300 shadow-2xl text-center space-y-1">
                <div className="font-black text-sm sm:text-base text-white tracking-wider uppercase flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  {eliminationBanner.text}
                </div>
                <div className="text-xs text-emerald-100 font-medium">
                  {eliminationBanner.subtext}
                </div>
              </div>
            </div>
          )}

          {/* Blackout Emergency Alarm Indicator */}
          {isBlackout && (
            <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-30 max-w-lg w-11/12 animate-pulse pointer-events-none">
              <div className="bg-red-950/95 border-2 border-red-500 text-red-200 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Power className="w-5 h-5 text-red-400 shrink-0" />
                  <div className="text-left">
                    <div className="font-black text-xs sm:text-sm text-red-300 uppercase tracking-wide flex items-center gap-1.5">
                      <span>⚡ APAGÃO GERAL DETECTADO!</span>
                    </div>
                    <div className="text-[11px] text-red-200/90 font-medium">
                      Lanterna tática ligada! Suba ao <b>2º Andar</b> e aperte <b>[E]</b> no Gerador para restabelecer os disjuntores!
                    </div>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-1 bg-red-900 border border-red-700 rounded text-red-100 font-bold shrink-0">
                  2º ANDAR
                </span>
              </div>
            </div>
          )}

          {/* Screen Center: Crosshair & Interactive Prompt */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {/* Tactical Crosshair */}
            <div className="relative w-6 h-6 flex items-center justify-center opacity-85">
              <div className="w-1.5 h-1.5 bg-amber-400 rounded-full shadow-sm shadow-amber-500/50" />
              <div className="absolute w-5 h-0.5 border-t border-slate-300" />
              <div className="absolute h-5 w-0.5 border-l border-slate-300" />
            </div>

            {/* Throw Charge Power Meter */}
            {throwCharge > 0 && (
              <div className="mt-3 flex flex-col items-center gap-1">
                <div className="w-36 h-3 bg-slate-900/95 rounded-full border border-slate-700 overflow-hidden shadow-2xl p-0.5">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-amber-400 to-rose-500 transition-all duration-75"
                    style={{ width: `${Math.round(throwCharge * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-black tracking-wider uppercase text-cyan-300 drop-shadow">
                  Força de Arremesso: {Math.round(throwCharge * 100)}%
                </span>
              </div>
            )}

            {/* Interaction Target Prompt */}
            {hoverProp && throwCharge === 0 && (
              <div className="mt-4 px-3.5 py-1.5 rounded-lg bg-amber-500/95 text-slate-950 font-bold text-xs sm:text-sm tracking-wide shadow-xl flex items-center gap-1.5">
                <span className="bg-slate-950 text-amber-400 px-1.5 py-0.5 rounded text-[11px] font-black">E</span>
                <span>Interagir / Pegar {hoverProp}</span>
              </div>
            )}
            {!hoverProp && heldProp && throwCharge === 0 && (
              <div className="mt-4 px-3 py-1 rounded-md bg-slate-900/80 border border-slate-700 text-slate-300 text-xs">
                <span className="font-bold text-amber-400">[E]</span> Largar | <span className="font-bold text-cyan-400">[RMB]</span> Mirar Arremesso | <span className="font-bold text-red-400">[LMB]</span> {heldProp.type === 'pistol' || heldProp.type === 'revolver' || heldProp.type === 'laser_gun' || heldProp.type === 'slingshot' || heldProp.type === 'crossbow' || heldProp.type === 'plasma_rifle' ? 'Disparar' : 'Golpear'}
              </div>
            )}
          </div>

          {/* Middle Floating: Employee Dossier Preview when aiming at NPC */}
          {hoverEmployee && (
            <div className="self-center mb-6 w-full max-w-md pointer-events-auto bg-slate-900/95 border-2 border-slate-700 rounded-2xl p-4 shadow-2xl backdrop-blur-none absolute bottom-24 left-1/2 -translate-x-1/2 z-20">
              <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center border-2 border-slate-600 font-black text-sm text-white shadow-inner"
                    style={{ backgroundColor: `#${hoverEmployee.attireColor.shirt.toString(16).padStart(6, '0')}` }}
                  >
                    {hoverEmployee.name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                      {hoverEmployee.name}
                      {hoverEmployee.nervousnessLevel > 0.6 && (
                        <span className="text-[10px] bg-red-900/80 text-red-200 border border-red-700 px-1.5 py-0.5 rounded font-mono font-semibold">
                          NERVOSO 💧
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-amber-400 font-semibold">{hoverEmployee.role}</p>
                  </div>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  {hoverEmployee.department}
                </span>
              </div>

              {/* Clues Comparison: Registered vs Actual */}
              <div className="space-y-1.5 text-xs">
                <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Uniforme no Sistema:</div>
                  <div className="text-slate-300 font-medium">{hoverEmployee.registeredAttire}</div>
                </div>

                <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Traje Observado Agora:</div>
                  <div className={`font-semibold ${
                    hoverEmployee.actualAttire !== hoverEmployee.registeredAttire 
                      ? 'text-red-400 font-bold' 
                      : 'text-emerald-400'
                  }`}>
                    {hoverEmployee.actualAttire}
                  </div>
                </div>

                <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Atividade Atual:</div>
                  <div className="text-slate-300 italic">"{hoverEmployee.currentActivity}"</div>
                </div>

                {/* Murmur / Thought dialogue */}
                <div className="bg-amber-950/30 border border-amber-900/40 p-2 rounded-lg text-amber-200/90 italic text-[11px]">
                  💭 "{hoverEmployee.nervousnessLevel > 0.4 ? hoverEmployee.dialogueNervous[0] : hoverEmployee.dialogueNormal[0]}"
                </div>
              </div>
            </div>
          )}

          {/* Bottom Bar: Held Weapon Slot & Mobile Touch Action Buttons */}
          <footer className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 z-20 flex items-end justify-between pointer-events-none">
            {/* Desktop Controls Guide */}
            <div className="hidden md:flex flex-col gap-1 text-[11px] text-slate-300 bg-slate-900/90 border border-slate-800 p-3 rounded-xl shadow-lg">
              <div className="font-bold text-slate-200 mb-0.5">Comandos do Chefe:</div>
              <div className="flex items-center gap-3">
                <span><b className="text-amber-400">WASD</b> Mover</span>
                <span><b className="text-amber-400">Mouse</b> Olhar Suave</span>
                <span><b className="text-amber-400">E</b> Pegar / Recuperar do Chão</span>
                <span><b className="text-red-400">LMB</b> Golpear/Atirar</span>
                <span><b className="text-cyan-400">Segurar RMB</b> Mirar Trajetória</span>
              </div>
            </div>

            {/* Mobile / Touch Action Controls */}
            <div className="flex md:hidden items-center gap-2 pointer-events-auto">
              <button
                onTouchStart={(e) => { e.preventDefault(); gameRef.current?.triggerInteractAction(); }}
                onClick={() => gameRef.current?.triggerInteractAction()}
                className="w-13 h-13 rounded-2xl bg-amber-500/90 active:bg-amber-400 text-slate-950 font-black text-xs flex flex-col items-center justify-center shadow-2xl border-2 border-amber-300 active:scale-95 transition-transform"
              >
                <span>🖐️</span>
                <span>PEGAR</span>
              </button>

              <button
                onTouchStart={(e) => { e.preventDefault(); gameRef.current?.triggerMeleeAction(); }}
                onClick={() => gameRef.current?.triggerMeleeAction()}
                className="w-13 h-13 rounded-2xl bg-red-600/90 active:bg-red-500 text-white font-black text-xs flex flex-col items-center justify-center shadow-2xl border-2 border-red-400 active:scale-95 transition-transform"
              >
                <span>💥</span>
                <span>ATACAR</span>
              </button>

              <button
                onTouchStart={(e) => { e.preventDefault(); gameRef.current?.triggerThrowAction(); }}
                onClick={() => gameRef.current?.triggerThrowAction()}
                className="w-13 h-13 rounded-2xl bg-cyan-600/90 active:bg-cyan-500 text-white font-black text-xs flex flex-col items-center justify-center shadow-2xl border-2 border-cyan-400 active:scale-95 transition-transform"
              >
                <span>🎯</span>
                <span>LANÇAR</span>
              </button>
            </div>

            {/* Held Weapon Display */}
            <div className="pointer-events-auto flex items-center gap-3 bg-slate-900/95 border border-slate-700/80 px-4 py-2.5 rounded-2xl shadow-xl">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-600 flex items-center justify-center text-2xl shadow-inner">
                {heldProp ? (
                  heldProp.type === 'chair' ? '🪑' : 
                  heldProp.type === 'knife' ? '🔪' :
                  heldProp.type === 'stun_baton' ? '⚡' :
                  heldProp.type === 'crossbow' ? '🏹' :
                  heldProp.type === 'sledgehammer' ? '🔨' :
                  heldProp.type === 'katana' ? '⚔️' :
                  heldProp.type === 'plasma_rifle' ? '🔮' :
                  heldProp.type === 'slingshot' ? '🎯' :
                  heldProp.type === 'whip' ? '➰' :
                  heldProp.type === 'pistol' ? '🔫' :
                  heldProp.type === 'revolver' ? '💥' :
                  heldProp.type === 'laser_gun' ? '⚡' :
                  heldProp.type === 'extinguisher' ? '🧯' :
                  heldProp.type === 'stapler' ? '📎' : 
                  heldProp.type === 'scissors' ? '✂️' : 
                  heldProp.type === 'mug' ? '☕' : 
                  heldProp.type === 'monitor' ? '🖥️' : '✏️'
                ) : '✊'}
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Arma em Mãos</div>
                <div className="font-bold text-sm text-slate-100">
                  {heldProp ? heldProp.name : 'Punhos Desarmados'}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  <span>Dano: <b className="text-red-400">{heldProp ? heldProp.damage : 35}</b></span>
                  {heldProp && (
                    <span>Peso: <b className="text-slate-300 uppercase">{heldProp.weightCategory}</b></span>
                  )}
                </div>
              </div>
            </div>
          </footer>
        </>
      )}

      {/* =========================================================================
          TITLE SCREEN MODAL
          ========================================================================= */}
      {phase === 'TITLE' && !showShopModal && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/75 p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-slate-900/95 border-2 border-slate-700 rounded-3xl p-6 sm:p-10 shadow-2xl text-center space-y-6">
            {/* Title Lockup */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-700 text-red-400 text-xs font-bold uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4" /> Suspense Corporativo 3D · 15 Fases Escalantes
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white uppercase drop-shadow-md">
                Assassino no Escritório
              </h1>
              <p className="text-amber-400 font-medium text-sm sm:text-base">
                Você é o dono da empresa. Entre seus funcionários há assassinos querendo te eliminar.
              </p>
            </div>

            {/* Economy & Phase Status Bar */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950/90 border border-slate-800 rounded-2xl p-3 text-sm">
              <div className="flex items-center justify-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <span>Suas Moedas:</span>
                <span className="text-amber-400 font-black text-base">{coins}</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Target className="w-5 h-5 text-indigo-400" />
                <span>Progresso:</span>
                <span className="text-indigo-300 font-bold">Fase {currentPhase} de 15</span>
              </div>
            </div>

            {/* Game Rules & Lore Brief */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 text-left text-xs sm:text-sm text-slate-300 space-y-3">
              <div className="flex items-start gap-2.5">
                <Clock className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-100">Campanha em 15 Fases Escalantes:</strong> Cada fase adiciona +1 assassino e +2 minutos de tempo (Fase 1: 1 assassino / 2 min, até Fase 15: 15 assassinos / 30 min).
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Power className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-100">Apagão Aleatório & Lanterna Tática:</strong> A energia pode apagar aleatoriamente após 30 segundos! A lanterna tática ativa automaticamente. <b>Cuidado:</b> no escuro, os assassinos tentam eliminar funcionários! Corra até o <b>2º Andar (Sala de Geradores)</b> e aperte [E] no console para religar a luz.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Shield className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-100">Policiais no Escritório:</strong> Oficiais e peritos criminais patrulham os andares. Mas atenção: <b>assassinos profissionais podem estar disfarçados de policiais</b> para se aproximarem de você!
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Coins className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-100">Recuperação de Itens do Chão:</strong> Itens arremessados permanecem firmes no chão com colisão real e podem ser recuperados a qualquer momento com [E]. Assassinos neutralizados deixam suas armas caírem!
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Eye className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-100">Pistas por Ações Suspeitas:</strong> Assassinos profissionais pensam com frieza. Identifique-os por suas <b>ações reais</b>: sabotar geradores, mexer no seu cofre, uniforme diferente do Dossiê RH ou fuga súbita quando você está armado!
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-red-300 bg-red-950/40 p-2.5 rounded-xl border border-red-900/60">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <strong>AVISO:</strong> Atacar um inocente reinicia na Fase 1, mas <b>todas as suas moedas e armas compradas continuam salvas!</b>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowShopModal(true)}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 font-bold text-base uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <ShoppingBag className="w-5 h-5" />
                Loja de Armas
              </button>

              <button
                onClick={() => startPhaseMatch(currentPhase)}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-amber-600 to-yellow-500 hover:from-red-500 hover:to-yellow-400 text-slate-950 font-black text-base uppercase tracking-wider shadow-2xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                Iniciar Fase {currentPhase}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          WEAPON ARSENAL & SHOP MODAL
          ========================================================================= */}
      {showShopModal && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/90 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-wide">Arsenal & Loja de Armas</h2>
                  <p className="text-xs text-slate-400">Adquira armamentos táticos para as próximas fases. Armas e moedas nunca são perdidas.</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/50 text-amber-300 font-bold text-sm">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>{coins} Moedas</span>
                </div>
                <button
                  onClick={() => setShowShopModal(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  ✕ Fechar
                </button>
              </div>
            </div>

            {/* Weapons Grid */}
            <div className="overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3.5 pr-1">
              {SHOP_WEAPONS.map((weapon) => {
                const isOwned = unlockedWeapons.includes(weapon.id);
                const isEquipped = equippedWeaponId === weapon.id;
                const canAfford = coins >= weapon.cost;

                return (
                  <div 
                    key={weapon.id} 
                    className={`p-4 rounded-2xl border transition-all ${
                      isEquipped 
                        ? 'bg-amber-950/20 border-amber-500/80 shadow-lg shadow-amber-500/10' 
                        : (isOwned ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-950/50 border-slate-800/80')
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                          {weapon.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-slate-100">{weapon.name}</h3>
                            {isEquipped && (
                              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-amber-500 text-slate-950">
                                EQUIPADA
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-amber-400/90 font-medium">{weapon.lethality}</div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {!isOwned && (
                          <div className="text-sm font-black text-amber-400 flex items-center gap-1 justify-end">
                            <Coins className="w-4 h-4" />
                            <span>{weapon.cost}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="mt-2.5 text-xs text-slate-400 line-clamp-2">
                      {weapon.description}
                    </p>

                    <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                      <div className="text-[11px] text-slate-400 flex items-center gap-3">
                        <span>Dano: <b className="text-red-400 font-bold">{weapon.damage}</b></span>
                        <span>Tipo: <b className="text-slate-300 font-medium">{weapon.isRanged ? 'Disparo à Distância' : 'Corpo a Corpo'}</b></span>
                      </div>

                      <div>
                        {isOwned ? (
                          <button
                            onClick={() => handleEquipWeapon(weapon)}
                            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                              isEquipped 
                                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                          >
                            {isEquipped ? 'Desequipar' : 'Equipar'}
                          </button>
                        ) : (
                          <button
                            disabled={!canAfford}
                            onClick={() => handleBuyWeapon(weapon)}
                            className={`px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                              canAfford 
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black active:scale-95' 
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <Coins className="w-3.5 h-3.5" />
                            <span>Comprar ({weapon.cost})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PHASE BRIEFING MODAL
          ========================================================================= */}
      {showPhaseBriefing && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border-2 border-indigo-500 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-indigo-950 border-2 border-indigo-500 text-indigo-400 flex items-center justify-center mx-auto shadow-lg">
              <Target className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="text-xs uppercase font-bold tracking-widest text-indigo-400">Briefing de Inteligência</span>
              <h2 className="text-2xl sm:text-3xl font-black text-white uppercase">
                Fase {currentPhase} de 15
              </h2>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left text-xs sm:text-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Assassinos Infiltrados:</span>
                <span className="text-red-400 font-black text-base">{currentPhase} Infiltrado(s)</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Tempo Limite da Rodada:</span>
                <span className="text-amber-400 font-bold text-base">{currentPhase * 2} Minutos</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Arma Equipada:</span>
                <span className="text-emerald-400 font-bold">{getEquippedWeaponDef()?.name || 'Punhos / Armas do Escritório'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs flex items-start gap-2">
                <Power className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <b>Alerta de Apagão Aleatório:</b> A luz pode apagar inesperadamente após 30s de jogo! A lanterna tática ativará automaticamente. Cuidado com assassinatos nas sombras — suba ao <b>2º Andar</b> e aperte [E] no gerador para restaurar a energia!
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowShopModal(true)}
                className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs uppercase tracking-wider cursor-pointer flex items-center gap-1.5"
              >
                <ShoppingBag className="w-4 h-4" />
                Loja
              </button>

              <button
                onClick={() => startPhaseMatch(currentPhase)}
                className="px-7 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black text-sm uppercase tracking-wider cursor-pointer shadow-lg active:scale-95 transition-transform"
              >
                Iniciar Fase Agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TEAM DOSSIER MODAL (HR DATABASE REVIEW)
          ========================================================================= */}
      {showDossierModal && gameRef.current && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-3xl bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <FileText className="w-6 h-6 text-amber-400" />
                <div>
                  <h2 className="text-xl font-black text-white">Dossiê de Recursos Humanos</h2>
                  <p className="text-xs text-slate-400">Registros oficiais dos funcionários cadastrados na sede.</p>
                </div>
              </div>
              <button
                onClick={() => setShowDossierModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                ✕ Fechar
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 text-xs">
              {gameRef.current.getMatchDossier()?.employees.map((emp) => (
                <div key={emp.id} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0 border border-slate-700"
                      style={{ backgroundColor: `#${emp.attireColor.shirt.toString(16).padStart(6, '0')}` }}
                    >
                      {emp.name[0]}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-200">{emp.name}</div>
                      <div className="text-amber-400 font-medium">{emp.role} · <span className="text-slate-400">{emp.department}</span></div>
                      <div className="mt-1 text-slate-400">
                        <strong className="text-slate-300">Uniforme Oficial Obrigatório:</strong> {emp.registeredAttire}
                      </div>
                      <div className="text-slate-400">
                        <strong className="text-slate-300">Atividade Atribuída:</strong> {emp.assignedTask}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-slate-800 text-slate-400 shrink-0">
                    {emp.assignedRoom}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VICTORY MODAL (COINS AWARD & PHASE PROGRESSION)
          ========================================================================= */}
      {phase === 'VICTORY' && gameOverResult && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-xl bg-slate-900 border-2 border-emerald-500 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-950 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <div className="text-xs uppercase font-bold tracking-widest text-emerald-400">
                Fase {gameOverResult.phase} Concluída com Sucesso!
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-white uppercase">
                {gameOverResult.phase === 15 ? 'Organização Criminosa Eliminada!' : 'Infiltrados Neutralizados!'}
              </h2>
            </div>

            {/* Coins Reward Card */}
            {gameOverResult.coinsEarned && (
              <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border-2 border-amber-400/80 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/30 flex items-center justify-center text-amber-300">
                    <Coins className="w-7 h-7" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs uppercase font-bold text-amber-400">Recompensa por Velocidade</div>
                    <div className="text-xl font-black text-white">+{gameOverResult.coinsEarned} Moedas</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Saldo Total:</span>
                  <span className="text-lg font-black text-amber-300">{coins} 🪙</span>
                </div>
              </div>
            )}

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left text-xs sm:text-sm space-y-3">
              <p className="text-slate-200 font-medium">
                {gameOverResult.reason}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Arma Oculta Neutralizada:</span>
                  <span className="text-red-400 font-bold">{gameOverResult.secretWeapon}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Tempo Restante:</span>
                  <span className="text-emerald-400 font-bold">{formatTime(secondsLeft)}</span>
                </div>
              </div>

              {gameOverResult.motive && (
                <div className="bg-slate-900/60 p-2.5 rounded-lg text-slate-300 text-xs italic">
                  <strong>Motivo Revelado:</strong> "{gameOverResult.motive}"
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => setShowShopModal(true)}
                className="w-full sm:w-1/2 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <ShoppingBag className="w-4 h-4" />
                Loja de Armas
              </button>

              <button
                onClick={handleNextPhase}
                className="w-full sm:w-1/2 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm uppercase tracking-wider transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <span>{currentPhase < 15 ? `Avançar para Fase ${currentPhase + 1}` : 'Jogar Novamente'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          GAME OVER MODAL (WRONG EMPLOYEE OR TIME EXPIRED)
          ========================================================================= */}
      {phase === 'GAME_OVER' && gameOverResult && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-xl bg-slate-900 border-2 border-red-600 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-950 border-2 border-red-500 text-red-400 flex items-center justify-center mx-auto shadow-lg">
              <AlertTriangle className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <div className="text-xs uppercase font-bold tracking-widest text-red-400">
                Fim de Jogo · Reinício na Fase 1
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-white uppercase">
                {gameOverResult.victim ? 'Erro Fatal de Julgamento!' : 'Tempo Esgotado!'}
              </h2>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left text-xs sm:text-sm space-y-3">
              <p className="text-red-300 font-medium">
                {gameOverResult.reason}
              </p>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Suas Moedas e Armas Continuam Salvas:</span>
                <span className="text-amber-400 font-black text-sm">{coins} 🪙</span>
              </div>

              {gameOverResult.murderer && (
                <div className="bg-red-950/30 border border-red-900/50 p-3 rounded-xl space-y-1">
                  <span className="text-[10px] text-red-400 uppercase font-bold block">Quem era o verdadeiro assassino:</span>
                  <div className="text-slate-100 font-bold text-sm">
                    {gameOverResult.murderer.name} — <span className="text-amber-400">{gameOverResult.murderer.role}</span>
                  </div>
                  <div className="text-xs text-slate-300">
                    <strong>Disfarce suspeito:</strong> Estava usando "{gameOverResult.murderer.actualAttire}" e agindo em "{gameOverResult.murderer.currentActivity}".
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => setShowShopModal(true)}
                className="w-full sm:w-1/2 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <ShoppingBag className="w-4 h-4" />
                Loja de Armas
              </button>

              <button
                onClick={handleRestartCampaign}
                className="w-full sm:w-1/2 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm uppercase tracking-wider transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Recomeçar da Fase 1
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
