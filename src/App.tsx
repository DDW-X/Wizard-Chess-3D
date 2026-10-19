import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ChessMove,
  GameState,
  PieceColor,
  SquareCoord,
  computeBestMove,
  coordToAlgebraic,
  createInitialGameState,
  createTacticalClashPreset,
  getAllLegalMoves,
  getLegalMovesForSquare,
  makeMove,
} from './game/chessEngine';
import { FactionTheme } from './game/physicsKinematics';
import { soundEngine } from './game/soundEngine';
import { spatialSoundEngine } from './audio/spatialSoundEngine';
import { CameraPreset, ChessViewport } from './components/ChessViewport';

type ShellState = 'title' | 'playing' | 'paused' | 'gameover';
type MatchMode = 'ai' | 'pass';

const FACTION_META: Record<
  FactionTheme,
  {
    label: string;
    subtitle: string;
    whiteName: string;
    blackName: string;
    accentColor: string;
    pieceNames: Record<string, string>;
  }
> = {
  gothic: {
    label: 'Gothic Crusaders',
    subtitle: 'Chainmail, Heraldry & Alabaster',
    whiteName: 'Silver Crusader Order',
    blackName: 'Obsidian Templar Host',
    accentColor: '#d9b352',
    pieceNames: {
      p: 'Crusader Footman',
      n: 'Barded Warhorse Knight',
      b: 'Sanctum Prelate',
      r: 'Gargoyle Watchtower',
      q: 'Sovereign Crusader Queen',
      k: 'High Crusader King',
    },
  },
  spartan: {
    label: 'The Spartans',
    subtitle: 'Bronze & Worn Leather',
    whiteName: 'Lacedaemon Bronze',
    blackName: 'Obsidian Phalanx',
    accentColor: '#e08e45',
    pieceNames: {
      p: 'Spartan Hoplite',
      n: 'Chariot War Stallion',
      b: 'Laconian Polemarch',
      r: 'Brazen Phalanx Bastion',
      q: 'Spartan Queen Gorgo',
      k: 'King Leonidas',
    },
  },
  roman: {
    label: 'Roman Empire',
    subtitle: 'Marble, Gold & Crimson',
    whiteName: 'Senatorial Legion',
    blackName: 'Praetorian Guard',
    accentColor: '#f5c542',
    pieceNames: {
      p: 'Roman Legionary',
      n: 'Equites Cataphract',
      b: 'Aquila Centurion',
      r: 'Imperial Castellum',
      q: 'Empress Augusta',
      k: 'Emperor Caesar',
    },
  },
};

export default function App() {
  const [shellState, setShellState] = useState<ShellState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'playing';
    }
    return 'title';
  });

  const [matchMode, setMatchMode] = useState<MatchMode>('ai');
  const [factionTheme, setFactionTheme] = useState<FactionTheme>(() => {
    if (typeof window !== 'undefined') {
      const f = new URLSearchParams(window.location.search).get('faction');
      if (f === 'gothic' || f === 'spartan' || f === 'roman') return f;
    }
    return 'gothic';
  });
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState()
  );
  const [selectedSquare, setSelectedSquare] = useState<SquareCoord | null>(
    null
  );
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>(() => {
    if (typeof window !== 'undefined') {
      const c = new URLSearchParams(window.location.search).get('camera');
      if (c === 'white' || c === 'overhead' || c === 'cathedral' || c === 'black' || c === 'orbit') {
        return c;
      }
    }
    return 'white';
  });
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [pendingMoveAnim, setPendingMoveAnim] = useState<ChessMove | null>(
    null
  );
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const [endSnapshot, setEndSnapshot] = useState<{
    winner: PieceColor | 'draw' | null;
    reason: string;
    totalMoves: number;
    capturedCount: number;
    durationSec: number;
  } | null>(null);

  const aiTimeoutRef = useRef<number | null>(null);
  const activeFactionMeta = FACTION_META[factionTheme];

  useEffect(() => {
    document.body.dataset.state = shellState;
    document.body.dataset.faction = factionTheme;
  }, [shellState, factionTheme]);

  useEffect(() => {
    if (shellState !== 'playing') return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [shellState]);

  const executeMoveWithAnimation = useCallback(
    (currentState: GameState, from: SquareCoord, to: SquareCoord) => {
      const legal = getLegalMovesForSquare(currentState, from);
      const chosen = legal.find(
        (m) => m.to.row === to.row && m.to.col === to.col
      );
      if (!chosen) return false;

      const nextState = makeMove(
        currentState,
        from,
        to,
        chosen.promotion ?? 'q'
      );
      if (!nextState) return false;

      setSelectedSquare(null);
      setPendingMoveAnim(chosen);
      setGameState(nextState);

      if (nextState.inCheck && nextState.status === 'playing') {
        soundEngine.playCheckBell();
      }
      return true;
    },
    []
  );

  const handleMoveAnimationComplete = useCallback(() => {
    setPendingMoveAnim(null);

    if (gameState.status !== 'playing') {
      soundEngine.playVictoryFanfare();
      setEndSnapshot({
        winner: gameState.winner,
        reason:
          gameState.status === 'checkmate'
            ? 'Checkmate by Royal Decree'
            : 'Stalemate Accord',
        totalMoves: gameState.moveHistory.length,
        capturedCount:
          gameState.capturedByWhite.length + gameState.capturedByBlack.length,
        durationSec: elapsedSeconds,
      });
      setShellState('gameover');
    }
  }, [gameState, elapsedSeconds]);

  useEffect(() => {
    if (
      shellState === 'playing' &&
      matchMode === 'ai' &&
      gameState.turn === 'b' &&
      gameState.status === 'playing' &&
      !pendingMoveAnim
    ) {
      aiTimeoutRef.current = window.setTimeout(() => {
        const aiMove = computeBestMove(gameState, 2);
        if (aiMove) {
          executeMoveWithAnimation(gameState, aiMove.from, aiMove.to);
        }
      }, 360);
    }
    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, [
    shellState,
    matchMode,
    gameState,
    pendingMoveAnim,
    executeMoveWithAnimation,
  ]);

  const handleSquareClick = useCallback(
    (coord: SquareCoord) => {
      if (shellState !== 'playing' || pendingMoveAnim) return;
      if (matchMode === 'ai' && gameState.turn === 'b') return;

      const clickedPiece = gameState.board[coord.row][coord.col];

      if (selectedSquare) {
        if (
          selectedSquare.row === coord.row &&
          selectedSquare.col === coord.col
        ) {
          setSelectedSquare(null);
          return;
        }
        const moved = executeMoveWithAnimation(
          gameState,
          selectedSquare,
          coord
        );
        if (moved) return;
      }

      if (clickedPiece && clickedPiece.color === gameState.turn) {
        soundEngine.playSelect();
        setSelectedSquare(coord);
      } else {
        setSelectedSquare(null);
      }
    },
    [
      shellState,
      pendingMoveAnim,
      matchMode,
      gameState,
      selectedSquare,
      executeMoveWithAnimation,
    ]
  );

  const handleStartGame = useCallback((useClashPreset = false) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    setPendingMoveAnim(null);
    setSelectedSquare(null);
    setEndSnapshot(null);
    setElapsedSeconds(0);
    setGameState(
      useClashPreset ? createTacticalClashPreset() : createInitialGameState()
    );
    setCameraPreset('white');
    setShellState('playing');
    soundEngine.playSelect();
    spatialSoundEngine.startAmbientSoundscape();
  }, []);

  const handleExecuteSuggestedMove = useCallback(() => {
    if (shellState !== 'playing' || pendingMoveAnim) return;
    const allMoves = getAllLegalMoves(gameState);
    if (allMoves.length === 0) return;

    const captures = allMoves.filter((m) => m.captured !== undefined);
    const chosen =
      captures.length > 0
        ? captures[0]
        : computeBestMove(gameState, 2) ?? allMoves[0];
    executeMoveWithAnimation(gameState, chosen.from, chosen.to);
  }, [shellState, pendingMoveAnim, gameState, executeMoveWithAnimation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (shellState === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartGame(false);
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        setShellState((prev) =>
          prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev
        );
      } else if (e.code === 'KeyH' && shellState === 'playing') {
        e.preventDefault();
        setDockCollapsed((prev) => !prev);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        setMuted((prev) => {
          const next = !prev;
          soundEngine.muted = next;
          spatialSoundEngine.setMuted(next);
          return next;
        });
      } else if (
        e.code === 'KeyR' &&
        (shellState === 'playing' || shellState === 'paused')
      ) {
        e.preventDefault();
        handleStartGame(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shellState, handleStartGame]);

  const displayedLegalMoves = useMemo(() => {
    if (selectedSquare) {
      return getLegalMovesForSquare(gameState, selectedSquare);
    }
    const all = getAllLegalMoves(gameState);
    return [...all]
      .sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0))
      .slice(0, 6);
  }, [gameState, selectedSquare]);

  const selectedPieceInfo = useMemo(() => {
    if (!selectedSquare) return null;
    const p = gameState.board[selectedSquare.row][selectedSquare.col];
    if (!p) return null;
    return {
      square: coordToAlgebraic(selectedSquare).toUpperCase(),
      name: activeFactionMeta.pieceNames[p.type] || 'Warrior',
      faction:
        p.color === 'w'
          ? activeFactionMeta.whiteName
          : activeFactionMeta.blackName,
    };
  }, [gameState, selectedSquare, activeFactionMeta]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none bg-[#090a0f]">
      {/* 100% Full-Viewport Three.js Gothic Cathedral & 32-Piece Chess Canvas */}
      <ChessViewport
        shellState={shellState}
        gameState={gameState}
        factionTheme={factionTheme}
        selectedSquare={selectedSquare}
        cameraPreset={cameraPreset}
        pendingMoveAnim={pendingMoveAnim}
        onSquareClick={handleSquareClick}
        onMoveAnimationComplete={handleMoveAnimationComplete}
      />

      {/* =====================================================================
          STATE 1: TITLE SCREEN (Live 3D Cathedral Tour + Faction Selector)
          ===================================================================== */}
      {shellState === 'title' && (
        <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 md:p-12">
          <div className="pointer-events-auto max-w-lg bg-[#0b0d14]/92 border border-[#d9b352]/30 rounded-xl p-6 md:p-7 shadow-2xl">
            <div className="flex items-center gap-4 mb-4">
              <svg
                viewBox="0 0 64 64"
                className="w-13 h-13 shrink-0"
                aria-hidden="true"
              >
                <polygon
                  points="32,4 56,18 56,46 32,60 8,46 8,18"
                  fill="#141824"
                  stroke="#d9b352"
                  strokeWidth="2.5"
                />
                <path
                  d="M32 10 L46 26 L40 48 L24 48 L18 26 Z"
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="1.5"
                />
                <path
                  d="M32 14 L32 46 M22 24 L42 24"
                  stroke="#f3efe6"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="32" cy="24" r="4" fill="#d9b352" />
              </svg>
              <div>
                <p className="text-xs tracking-[0.2em] text-[#d9b352] font-semibold">
                  AAA 3D SANCTUM EDITION
                </p>
                <h1
                  className="font-display text-3xl md:text-4xl font-bold text-[#f5f2eb] tracking-wide"
                  style={{ textWrap: 'balance' }}
                >
                  WIZARD&apos;S CHESS
                </h1>
              </div>
            </div>

            <p className="text-sm text-[#c4bfb4] leading-relaxed mb-5">
              Command thirty-two sculpted warriors across a sunlit Gothic nave.
              Swap faction armies on the fly—from medieval Gothic guardians to
              Spartan Hoplites and Roman Imperial Legions.
            </p>

            {/* Faction Theme Switcher on Title Screen */}
            <div className="mb-4">
              <div className="text-[11px] font-semibold tracking-wider text-[#d9b352] mb-2">
                SELECT ARMY FACTION THEME
              </div>
              <div
                className="grid grid-cols-3 gap-1.5 p-1 bg-[#141824]/90 rounded-lg border border-white/10"
                role="group"
                aria-label="Select Faction Theme"
              >
                {(['gothic', 'spartan', 'roman'] as FactionTheme[]).map(
                  (tKey) => {
                    const meta = FACTION_META[tKey];
                    const active = factionTheme === tKey;
                    return (
                      <button
                        key={tKey}
                        type="button"
                        onClick={() => setFactionTheme(tKey)}
                        className={`py-2 px-2 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                          active
                            ? 'bg-[#d9b352] text-[#090a0f] shadow-md'
                            : 'text-[#c4bfb4] hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Mode Selection Segmented Control */}
            <div
              className="grid grid-cols-2 gap-2 p-1 bg-[#141824] rounded-lg border border-white/10 mb-5"
              role="group"
              aria-label="Select Match Mode"
            >
              <button
                type="button"
                onClick={() => setMatchMode('ai')}
                className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  matchMode === 'ai'
                    ? 'bg-[#d9b352] text-[#090a0f]'
                    : 'text-[#c4bfb4] hover:text-white'
                }`}
              >
                Vs. Grandmaster Automaton
              </button>
              <button
                type="button"
                onClick={() => setMatchMode('pass')}
                className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  matchMode === 'pass'
                    ? 'bg-[#d9b352] text-[#090a0f]'
                    : 'text-[#c4bfb4] hover:text-white'
                }`}
              >
                2-Player Pass &amp; Play
              </button>
            </div>

            {/* Primary & Secondary Start Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                data-start="true"
                data-testid="start-sanctum-match-btn"
                onClick={() => handleStartGame(false)}
                className="flex-1 py-3 px-5 rounded-lg bg-[#d9b352] hover:bg-[#e5c267] text-[#090a0f] font-bold text-sm tracking-wide transition-transform active:scale-98 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Enter the Sanctum
              </button>
              <button
                type="button"
                onClick={() => handleStartGame(true)}
                className="py-3 px-4 rounded-lg bg-[#1b2030] hover:bg-[#252c42] text-[#f0ede6] border border-[#d9b352]/40 font-semibold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Start in Tactical Clash
              </button>
            </div>
          </div>

          <div className="text-center md:text-left">
            <p className="inline-block text-xs text-[#a39e93] tracking-wide">
              Click Tile or Piece to Move · Drag to Orbit Camera · Scroll to Zoom · Swap Faction Themes On The Fly
            </p>
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 2: PLAYING HUD + GLASSMORPHISM FACTION THEME SWITCHER
          ===================================================================== */}
      {shellState === 'playing' && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
          {/* Top Perimeter Row: Left Turn/Score Plaque + Center-Right Glassmorphism Faction Switcher + Right Utilities */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            {/* Top-Left World-Matched Turn & Material Plaque */}
            <div className="pointer-events-auto bg-[#0b0d14]/90 border border-[#d9b352]/30 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-xl flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5">
                <svg
                  viewBox="0 0 36 36"
                  className="w-7 h-7 sm:w-8 sm:h-8 shrink-0"
                  aria-hidden="true"
                >
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill={gameState.turn === 'w' ? '#f3efe6' : '#161925'}
                    stroke={gameState.turn === 'w' ? '#d9b352' : '#e11d48'}
                    strokeWidth="2.5"
                  />
                  <path
                    d="M18 8 L23 18 L18 28 L13 18 Z"
                    fill={gameState.turn === 'w' ? '#3b82f6' : '#f43f5e'}
                  />
                </svg>
                <div>
                  <div className="text-[10px] font-semibold tracking-wider text-[#a39e93] whitespace-nowrap">
                    {gameState.inCheck
                      ? 'DECREE · CHECK!'
                      : activeFactionMeta.label.toUpperCase()}
                  </div>
                  <div className="font-display text-sm sm:text-base font-bold text-[#f5f2eb] whitespace-nowrap">
                    {gameState.turn === 'w'
                      ? activeFactionMeta.whiteName
                      : activeFactionMeta.blackName}
                  </div>
                </div>
              </div>

              <div className="h-7 w-px bg-white/10" />

              <div className="flex items-center gap-3">
                <div>
                  <div className="text-[9px] font-semibold tracking-wider text-[#a39e93]">
                    PLY
                  </div>
                  <div
                    data-testid="hud-move-count"
                    className="font-mono-tabular text-sm sm:text-base font-bold text-[#d9b352]"
                  >
                    {gameState.moveHistory.length}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-semibold tracking-wider text-[#a39e93]">
                    SHATTERED
                  </div>
                  <div
                    data-testid="hud-shattered-count"
                    className="font-mono-tabular text-sm sm:text-base font-bold text-[#f43f5e]"
                  >
                    {gameState.capturedByWhite.length +
                      gameState.capturedByBlack.length}
                  </div>
                </div>
                <div className="hidden md:block">
                  <div className="text-[9px] font-semibold tracking-wider text-[#a39e93]">
                    TIME
                  </div>
                  <div className="font-mono-tabular text-xs font-semibold text-[#e2ddd3]">
                    {formatTime(elapsedSeconds)}
                  </div>
                </div>
              </div>
            </div>

            {/* Sleek Glassmorphism Floating Faction Theme Switcher Panel */}
            <div
              data-testid="faction-switcher-panel"
              className="pointer-events-auto bg-[#0b0d14]/90 border border-[#d9b352]/35 rounded-xl px-2.5 py-1.5 shadow-2xl flex items-center gap-1.5"
            >
              <span className="hidden lg:inline-block text-[10px] font-semibold tracking-widest text-[#d9b352] px-1.5">
                FACTION
              </span>
              {(['gothic', 'spartan', 'roman'] as FactionTheme[]).map(
                (tKey) => {
                  const meta = FACTION_META[tKey];
                  const isActive = factionTheme === tKey;
                  return (
                    <button
                      key={tKey}
                      type="button"
                      data-testid={`faction-btn-${tKey}`}
                      onClick={() => setFactionTheme(tKey)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-[#d9b352] text-[#090a0f] shadow-md'
                          : 'text-[#d4cfc4] hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor: isActive
                            ? '#090a0f'
                            : meta.accentColor,
                        }}
                      />
                      <span>{meta.label}</span>
                    </button>
                  );
                }
              )}
            </div>

            {/* Top-Right Compact Utility Icon Buttons (Mute [M], Pause [P], Reset [R]) */}
            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setMuted((prev) => {
                    const next = !prev;
                    soundEngine.muted = next;
                    spatialSoundEngine.setMuted(next);
                    return next;
                  });
                }}
                className="w-9 h-9 rounded-lg bg-[#0b0d14]/90 border border-white/15 hover:border-[#d9b352] flex items-center justify-center text-[#e2ddd3] transition-colors cursor-pointer"
                title="Mute / Unmute [M]"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  {muted ? (
                    <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                  ) : (
                    <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
                  )}
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Reset Board"
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleStartGame(false);
                }}
                className="w-9 h-9 rounded-lg bg-[#0b0d14]/90 border border-white/15 hover:border-[#d9b352] flex items-center justify-center text-[#e2ddd3] transition-colors cursor-pointer"
                title="Reset Match [R]"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Pause Game"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setShellState('paused');
                }}
                className="w-9 h-9 rounded-lg bg-[#0b0d14]/90 border border-white/15 hover:border-[#d9b352] flex items-center justify-center text-[#e2ddd3] transition-colors cursor-pointer"
                title="Pause [P / Esc]"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Bottom Unified Collapsible Control Dock */}
          <div className="pointer-events-auto mx-auto w-full max-w-[920px] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setDockCollapsed((prev) => !prev)}
              className="px-4 py-1 rounded-t-lg bg-[#0b0d14]/90 border border-b-0 border-[#d9b352]/30 text-xs font-medium text-[#c4bfb4] hover:text-white transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
            >
              <svg
                viewBox="0 0 16 16"
                className="w-3.5 h-3.5 stroke-current"
                fill="none"
                strokeWidth="2"
                aria-hidden="true"
              >
                {dockCollapsed ? (
                  <path
                    d="M4 10l4-4 4 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <path
                    d="M4 6l4 4 4-4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
              <span>
                {dockCollapsed ? 'Show Controls [H]' : 'Hide Controls [H]'}
              </span>
            </button>

            {!dockCollapsed && (
              <div className="w-full bg-[#0b0d14]/92 border border-[#d9b352]/30 rounded-xl p-2.5 md:p-3.5 shadow-2xl flex flex-col gap-2">
                {/* Row 1: Selected Piece / Tactical Command Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2 text-xs">
                    {selectedPieceInfo ? (
                      <span className="text-[#f5f2eb] font-medium">
                        Selected:{' '}
                        <strong className="text-[#d9b352]">
                          {selectedPieceInfo.name}
                        </strong>{' '}
                        ({selectedPieceInfo.square})
                      </span>
                    ) : (
                      <span className="text-[#c4bfb4]">
                        {activeFactionMeta.label} ({activeFactionMeta.subtitle}) · Click a piece or legal move:
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {displayedLegalMoves.map((m) => {
                      const fromSq = coordToAlgebraic(m.from);
                      const toSq = coordToAlgebraic(m.to);
                      const isCap = Boolean(m.captured);
                      return (
                        <button
                          key={`${fromSq}-${toSq}-${m.san}`}
                          type="button"
                          onClick={() =>
                            executeMoveWithAnimation(gameState, m.from, m.to)
                          }
                          disabled={Boolean(pendingMoveAnim)}
                          className={`px-2.5 py-1 rounded text-xs font-mono-tabular font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer ${
                            isCap
                              ? 'bg-[#881337] hover:bg-[#9f1239] text-[#ffe4e6] border border-[#f43f5e]/50'
                              : 'bg-[#171c2b] hover:bg-[#232a40] text-[#e2ddd3] border border-white/10'
                          }`}
                        >
                          <span>{m.san}</span>
                          {isCap && (
                            <svg
                              viewBox="0 0 16 16"
                              className="w-3 h-3 stroke-current shrink-0"
                              fill="none"
                              strokeWidth="2"
                              aria-hidden="true"
                            >
                              <path
                                d="M3 13L13 3M3 3l10 10"
                                strokeLinecap="round"
                              />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Row 2: Camera Presets + Mode Switcher + Tactical Clash Action */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1 bg-[#141824] p-1 rounded-lg border border-white/10">
                    {(
                      [
                        ['white', 'White'],
                        ['overhead', 'Top'],
                        ['cathedral', 'Sanctum'],
                        ['black', 'Black'],
                        ['orbit', 'Orbit'],
                      ] as [CameraPreset, string][]
                    ).map(([presetKey, label]) => (
                      <button
                        key={presetKey}
                        type="button"
                        onClick={() => setCameraPreset(presetKey)}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          cameraPreset === presetKey
                            ? 'bg-[#d9b352] text-[#090a0f] font-semibold'
                            : 'text-[#c4bfb4] hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setMatchMode((prev) => (prev === 'ai' ? 'pass' : 'ai'))
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-[#171c2b] hover:bg-[#22293e] border border-white/10 text-xs font-medium text-[#e2ddd3] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {matchMode === 'ai' ? 'Vs. Automaton' : 'Pass & Play'}
                    </button>

                    <button
                      type="button"
                      data-testid="preset-tactical-clash-btn"
                      onClick={() => handleStartGame(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#171c2b] hover:bg-[#22293e] border border-[#d9b352]/40 text-xs font-semibold text-[#d9b352] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Load Clash Preset
                    </button>

                    <button
                      type="button"
                      data-testid="trigger-arcane-strike-btn"
                      onClick={handleExecuteSuggestedMove}
                      disabled={Boolean(pendingMoveAnim)}
                      className="px-3 py-1.5 rounded-lg bg-[#d9b352] hover:bg-[#e5c267] text-[#090a0f] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Play Tactical Move
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 3: PAUSE MODAL
          ===================================================================== */}
      {shellState === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-modal-title"
          className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-[#0b0d14] border border-[#d9b352]/40 rounded-xl p-6 shadow-2xl">
            <p className="text-xs font-semibold tracking-widest text-[#d9b352] mb-1">
              SANCTUM INTERMISSION
            </p>
            <h2
              id="pause-modal-title"
              className="font-display text-2xl font-bold text-[#f5f2eb] mb-5"
            >
              Match Paused
            </h2>

            <div className="grid grid-cols-3 gap-3 mb-6 p-3 bg-[#141824] rounded-lg border border-white/10">
              <div>
                <div className="text-[10px] font-semibold text-[#a39e93]">
                  MOVES
                </div>
                <div className="font-mono-tabular text-lg font-bold text-[#f5f2eb]">
                  {gameState.moveHistory.length}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#a39e93]">
                  SHATTERED
                </div>
                <div className="font-mono-tabular text-lg font-bold text-[#f43f5e]">
                  {gameState.capturedByWhite.length +
                    gameState.capturedByBlack.length}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#a39e93]">
                  ELAPSED
                </div>
                <div className="font-mono-tabular text-lg font-bold text-[#d9b352]">
                  {formatTime(elapsedSeconds)}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setShellState('playing')}
                className="w-full py-2.5 px-4 rounded-lg bg-[#d9b352] hover:bg-[#e5c267] text-[#090a0f] font-bold text-sm transition-colors cursor-pointer"
              >
                Resume Match
              </button>
              <button
                type="button"
                onClick={() => handleStartGame(false)}
                className="w-full py-2.5 px-4 rounded-lg bg-[#171c2b] hover:bg-[#22293e] text-[#f0ede6] border border-white/15 font-semibold text-sm transition-colors cursor-pointer"
              >
                Restart Match
              </button>
              <button
                type="button"
                onClick={() => setShellState('title')}
                className="w-full py-2.5 px-4 rounded-lg bg-transparent hover:bg-white/5 text-[#a39e93] hover:text-white font-medium text-sm transition-colors cursor-pointer"
              >
                Return to Title
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 4: GAME OVER / VICTORY MODAL
          ===================================================================== */}
      {shellState === 'gameover' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gameover-modal-title"
          className="fixed inset-0 z-30 bg-black/80 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-[#0b0d14] border border-[#d9b352]/50 rounded-xl p-6 shadow-2xl">
            <p className="text-xs font-semibold tracking-widest text-[#d9b352] mb-1">
              {endSnapshot?.reason || 'SANCTUM CONCLUDED'}
            </p>
            <h2
              id="gameover-modal-title"
              className="font-display text-2xl md:text-3xl font-bold text-[#f5f2eb] mb-5"
            >
              {endSnapshot?.winner === 'w'
                ? `${activeFactionMeta.whiteName} Triumphs`
                : endSnapshot?.winner === 'b'
                ? `${activeFactionMeta.blackName} Triumphs`
                : 'Drawn Sanctuary Accord'}
            </h2>

            <div className="grid grid-cols-3 gap-3 mb-6 p-3 bg-[#141824] rounded-lg border border-white/10">
              <div>
                <div className="text-[10px] font-semibold text-[#a39e93]">
                  TOTAL PLY
                </div>
                <div className="font-mono-tabular text-lg font-bold text-[#f5f2eb]">
                  {endSnapshot?.totalMoves ?? gameState.moveHistory.length}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#a39e93]">
                  SHATTERED
                </div>
                <div className="font-mono-tabular text-lg font-bold text-[#f43f5e]">
                  {endSnapshot?.capturedCount ??
                    gameState.capturedByWhite.length +
                      gameState.capturedByBlack.length}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#a39e93]">
                  CLEAR TIME
                </div>
                <div className="font-mono-tabular text-lg font-bold text-[#d9b352]">
                  {formatTime(endSnapshot?.durationSec ?? elapsedSeconds)}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={() => handleStartGame(false)}
                className="w-full py-3 px-4 rounded-lg bg-[#d9b352] hover:bg-[#e5c267] text-[#090a0f] font-bold text-sm transition-colors cursor-pointer"
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={() => setShellState('title')}
                className="w-full py-2.5 px-4 rounded-lg bg-[#171c2b] hover:bg-[#22293e] text-[#e2ddd3] font-medium text-sm transition-colors cursor-pointer"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
