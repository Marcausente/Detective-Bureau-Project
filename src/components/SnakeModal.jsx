/* eslint-disable react/prop-types */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';

const GRID_SIZE = 20; // 20x20 grid
const SPEED_MODES = {
    Normal: { ms: 120, label: 'snakeSpeedNormal' },
    Fast: { ms: 85, label: 'snakeSpeedFast' },
    Extreme: { ms: 55, label: 'snakeSpeedExtreme' }
};

export default function SnakeModal({ onClose, profile, onSwitchGame }) {
    const { t, currentLanguage } = useLanguage();
    const [activeTab, setActiveTab] = useState('game'); // 'game' | 'leaderboard'
    const [speedMode, setSpeedMode] = useState('Normal');
    
    // Snake state
    const [snake, setSnake] = useState([
        { x: 10, y: 10 },
        { x: 10, y: 11 },
        { x: 10, y: 12 }
    ]);
    const [direction, setDirection] = useState({ x: 0, y: -1 }); // Moving Up initially
    const [food, setFood] = useState({ x: 5, y: 5 });
    const [gameStatus, setGameStatus] = useState('idle'); // 'idle' | 'playing' | 'paused' | 'gameover'
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
    const [scoreSaving, setScoreSaving] = useState(false);
    
    const canvasRef = useRef(null);
    const directionRef = useRef(direction);
    const gameStatusRef = useRef(gameStatus);
    const snakeRef = useRef(snake);
    const foodRef = useRef(food);
    const scoreRef = useRef(score);

    // Keep refs updated for event listeners / intervals
    useEffect(() => { directionRef.current = direction; }, [direction]);
    useEffect(() => { gameStatusRef.current = gameStatus; }, [gameStatus]);
    useEffect(() => { snakeRef.current = snake; }, [snake]);
    useEffect(() => { foodRef.current = food; }, [food]);
    useEffect(() => { scoreRef.current = score; }, [score]);

    // Generate random food position not on snake
    const generateFood = useCallback((currentSnake) => {
        let newFood;
        while (!newFood) {
            const fx = Math.floor(Math.random() * GRID_SIZE);
            const fy = Math.floor(Math.random() * GRID_SIZE);
            const isOnSnake = currentSnake.some(segment => segment.x === fx && segment.y === fy);
            if (!isOnSnake) {
                newFood = { x: fx, y: fy };
            }
        }
        return newFood;
    }, []);

    // Reset / Init Game
    const resetGame = useCallback(() => {
        const initialSnake = [
            { x: 10, y: 10 },
            { x: 10, y: 11 },
            { x: 10, y: 12 }
        ];
        const initialDirection = { x: 0, y: -1 };
        setSnake(initialSnake);
        setDirection(initialDirection);
        setScore(0);
        setFood(generateFood(initialSnake));
        setGameStatus('idle');
    }, [generateFood]);

    const startGame = () => {
        resetGame();
        setGameStatus('playing');
    };

    const togglePause = () => {
        if (gameStatus === 'playing') setGameStatus('paused');
        else if (gameStatus === 'paused') setGameStatus('playing');
    };

    // Handle direction changes securely (prevent 180-degree self-reversal)
    const changeDirection = useCallback((newDir) => {
        if (gameStatusRef.current !== 'playing') return;
        const currentDir = directionRef.current;
        // Check if opposite direction
        if (currentDir.x + newDir.x === 0 && currentDir.y + newDir.y === 0) return;
        setDirection(newDir);
    }, []);

    // Keyboard listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (activeTab !== 'game') return;

            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    e.preventDefault();
                    changeDirection({ x: 0, y: -1 });
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    e.preventDefault();
                    changeDirection({ x: 0, y: 1 });
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    e.preventDefault();
                    changeDirection({ x: -1, y: 0 });
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    e.preventDefault();
                    changeDirection({ x: 1, y: 0 });
                    break;
                case ' ':
                    e.preventDefault();
                    togglePause();
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, changeDirection]);

    // Save score to Supabase
    const saveScore = useCallback(async (finalScore) => {
        if (!profile || finalScore <= 0) return;
        setScoreSaving(true);
        try {
            await supabase
                .from('snake_scores')
                .insert({
                    user_id: profile.id,
                    score: finalScore,
                    speed_mode: speedMode
                });
        } catch (err) {
            console.error('Error saving snake score:', err);
        } finally {
            setScoreSaving(false);
        }
    }, [profile, speedMode]);

    // Game loop tick
    useEffect(() => {
        if (gameStatus !== 'playing') return;

        const intervalMs = SPEED_MODES[speedMode].ms;
        const timer = setInterval(() => {
            const curSnake = snakeRef.current;
            const curDir = directionRef.current;
            const curFood = foodRef.current;

            const head = { ...curSnake[0] };
            const newHead = { x: head.x + curDir.x, y: head.y + curDir.y };

            // Check Wall collision
            if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
                setGameStatus('gameover');
                saveScore(scoreRef.current);
                return;
            }

            // Check Self collision
            const selfCollide = curSnake.some(seg => seg.x === newHead.x && seg.y === newHead.y);
            if (selfCollide) {
                setGameStatus('gameover');
                saveScore(scoreRef.current);
                return;
            }

            const newSnake = [newHead, ...curSnake];

            // Check Food collision
            if (newHead.x === curFood.x && newHead.y === curFood.y) {
                const newScore = scoreRef.current + 10;
                setScore(newScore);
                if (newScore > highScore) setHighScore(newScore);
                setFood(generateFood(newSnake));
            } else {
                newSnake.pop(); // Remove tail
            }

            setSnake(newSnake);
        }, intervalMs);

        return () => clearInterval(timer);
    }, [gameStatus, speedMode, generateFood, highScore, saveScore]);

    // Fetch Leaderboard
    const fetchLeaderboard = useCallback(async () => {
        setLoadingLeaderboard(true);
        try {
            const { data, error } = await supabase
                .from('snake_scores')
                .select('*, user:user_id(id, nombre, apellido, rango, no_placa, profile_image)')
                .order('score', { ascending: false })
                .limit(20);

            if (error) {
                console.error('Error fetching snake leaderboard:', error);
            } else {
                setLeaderboard(data || []);
            }
        } catch (err) {
            console.error('Failed to fetch snake leaderboard:', err);
        } finally {
            setLoadingLeaderboard(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'leaderboard') {
            fetchLeaderboard();
        }
    }, [activeTab, fetchLeaderboard]);

    // Render Canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const cellSize = width / GRID_SIZE;

        // Clear canvas
        ctx.fillStyle = '#0b1120';
        ctx.fillRect(0, 0, width, width);

        // Draw Grid lines (subtle)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= GRID_SIZE; i++) {
            ctx.beginPath();
            ctx.moveTo(i * cellSize, 0);
            ctx.lineTo(i * cellSize, width);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, i * cellSize);
            ctx.lineTo(width, i * cellSize);
            ctx.stroke();
        }

        // Draw Food 🍎
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(
            food.x * cellSize + cellSize / 2,
            food.y * cellSize + cellSize / 2,
            cellSize / 2.4,
            0,
            2 * Math.PI
        );
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow

        // Draw Snake 🐍
        snake.forEach((segment, idx) => {
            const isHead = idx === 0;

            if (isHead) {
                ctx.fillStyle = '#10b981'; // Vibrant emerald green for head
                ctx.shadowColor = '#10b981';
                ctx.shadowBlur = 8;
            } else {
                // Gradient effect along body
                const alpha = Math.max(0.4, 1 - (idx / (snake.length + 5)));
                ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`;
                ctx.shadowBlur = 0;
            }

            const padding = 1.5;
            ctx.fillRect(
                segment.x * cellSize + padding,
                segment.y * cellSize + padding,
                cellSize - (padding * 2),
                cellSize - (padding * 2)
            );

            // Draw eyes on head
            if (isHead) {
                ctx.fillStyle = '#ffffff';
                const eyeRadius = cellSize / 8;
                let eye1X = segment.x * cellSize + cellSize * 0.3;
                let eye1Y = segment.y * cellSize + cellSize * 0.3;
                let eye2X = segment.x * cellSize + cellSize * 0.7;
                let eye2Y = segment.y * cellSize + cellSize * 0.3;

                if (direction.x === 1) { // Right
                    eye1X = eye2X = segment.x * cellSize + cellSize * 0.7;
                    eye1Y = segment.y * cellSize + cellSize * 0.3;
                    eye2Y = segment.y * cellSize + cellSize * 0.7;
                } else if (direction.x === -1) { // Left
                    eye1X = eye2X = segment.x * cellSize + cellSize * 0.3;
                    eye1Y = segment.y * cellSize + cellSize * 0.3;
                    eye2Y = segment.y * cellSize + cellSize * 0.7;
                } else if (direction.y === 1) { // Down
                    eye1Y = eye2Y = segment.y * cellSize + cellSize * 0.7;
                    eye1X = segment.x * cellSize + cellSize * 0.3;
                    eye2X = segment.x * cellSize + cellSize * 0.7;
                }

                ctx.beginPath();
                ctx.arc(eye1X, eye1Y, eyeRadius, 0, 2 * Math.PI);
                ctx.arc(eye2X, eye2Y, eyeRadius, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    }, [snake, food, direction]);

    return (
        <div className="cropper-modal-overlay ms-modal-overlay">
            <div className="cropper-modal-content ms-modal-content snake-modal-content">
                {/* Header */}
                <div className="ms-modal-header">
                    <div className="ms-modal-title">
                        🐍 {t('snakeTitle')}
                    </div>
                    <button className="ms-close-btn" onClick={onClose}>✕</button>
                </div>

                {/* Game Switcher Tabs */}
                <div className="minigame-switcher">
                    <button 
                        className="game-switch-btn" 
                        onClick={() => onSwitchGame && onSwitchGame('minesweeper')}
                    >
                        💣 Buscaminas
                    </button>
                    <button 
                        className="game-switch-btn active"
                        onClick={() => onSwitchGame && onSwitchGame('snake')}
                    >
                        🐍 Snake
                    </button>
                </div>

                {/* Internal Tabs (Game vs Leaderboard) */}
                <div className="ms-tabs">
                    <button 
                        className={`ms-tab-btn ${activeTab === 'game' ? 'active' : ''}`}
                        onClick={() => setActiveTab('game')}
                    >
                        🎮 {t('msGameTab')}
                    </button>
                    <button 
                        className={`ms-tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
                        onClick={() => setActiveTab('leaderboard')}
                    >
                        🏆 {t('msLeaderboard')}
                    </button>
                </div>

                {/* Modal Body */}
                <div className="ms-modal-body">
                    {activeTab === 'game' ? (
                        <div className="snake-game-view">
                            {/* Controls Bar */}
                            <div className="ms-game-controls">
                                <div className="ms-difficulty-selector">
                                    {Object.keys(SPEED_MODES).map((mode) => (
                                        <button
                                            key={mode}
                                            className={`ms-diff-btn ${speedMode === mode ? 'active' : ''}`}
                                            onClick={() => {
                                                if (gameStatus === 'idle' || gameStatus === 'gameover') {
                                                    setSpeedMode(mode);
                                                }
                                            }}
                                            disabled={gameStatus === 'playing'}
                                        >
                                            {t(SPEED_MODES[mode].label)}
                                        </button>
                                    ))}
                                </div>

                                <div className="ms-stats-bar">
                                    <div className="ms-stat-counter" title="Current Score">
                                        🍎 {score}
                                    </div>
                                    <button 
                                        className="ms-reset-btn" 
                                        onClick={gameStatus === 'playing' || gameStatus === 'paused' ? togglePause : startGame}
                                        disabled={scoreSaving}
                                    >
                                        {gameStatus === 'playing' ? '⏸️' : gameStatus === 'paused' ? '▶️' : '🎮'}
                                    </button>
                                    <div className="ms-stat-counter" title="High Score">
                                        🏆 {highScore}
                                    </div>
                                </div>
                            </div>

                            {/* Game Info Message */}
                            {gameStatus === 'gameover' && (
                                <div className="ms-alert ms-alert-danger">
                                    💀 {t('snakeGameOver')} {score > 0 ? (scoreSaving ? 'Saving score...' : `${t('snakeWinScoreSaved')} Score: ${score}`) : ''}
                                </div>
                            )}
                            {gameStatus === 'paused' && (
                                <div className="ms-alert ms-alert-success">
                                    ⏸️ {t('snakePause')}
                                </div>
                            )}
                            {gameStatus === 'idle' && (
                                <div className="snake-start-banner" onClick={startGame}>
                                    <button className="snake-start-btn">▶️ {t('snakeStart')}</button>
                                </div>
                            )}

                            {/* Canvas Grid */}
                            <div className="snake-canvas-container">
                                <canvas 
                                    ref={canvasRef} 
                                    width={320} 
                                    height={320} 
                                    className="snake-canvas" 
                                />
                            </div>

                            {/* Touch D-Pad for Mobile / Click Play */}
                            <div className="snake-dpad">
                                <div className="dpad-row">
                                    <button className="dpad-btn up" onClick={() => changeDirection({ x: 0, y: -1 })}>⬆️</button>
                                </div>
                                <div className="dpad-row middle">
                                    <button className="dpad-btn left" onClick={() => changeDirection({ x: -1, y: 0 })}>⬅️</button>
                                    <button className="dpad-btn down" onClick={() => changeDirection({ x: 0, y: 1 })}>⬇️</button>
                                    <button className="dpad-btn right" onClick={() => changeDirection({ x: 1, y: 0 })}>➡️</button>
                                </div>
                            </div>

                            <div className="ms-game-footer">
                                <small>{t('snakeControlsInfo')}</small>
                            </div>
                        </div>
                    ) : (
                        <div className="ms-leaderboard-view">
                            {loadingLeaderboard ? (
                                <div className="ms-loader">{t('msLoading')}</div>
                            ) : leaderboard.length === 0 ? (
                                <div className="ms-no-scores">{t('msNoScores')}</div>
                            ) : (
                                <div className="ms-leaderboard-table-container">
                                    <table className="ms-leaderboard-table">
                                        <thead>
                                            <tr>
                                                <th>{t('msRank')}</th>
                                                <th>{t('msAgent')}</th>
                                                <th>{t('snakeScore')}</th>
                                                <th>Modo</th>
                                                <th>{t('msDate')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {leaderboard.map((scoreObj, index) => {
                                                const agent = scoreObj.user;
                                                const agentName = agent 
                                                    ? `${agent.rango || ''} ${agent.nombre || ''} ${agent.apellido || ''} (${agent.no_placa || '?'})`
                                                    : 'Unknown Agent';
                                                const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
                                                
                                                return (
                                                    <tr key={scoreObj.id} className={agent?.id === profile?.id ? 'current-user-row' : ''}>
                                                        <td className="rank-col">{rankEmoji}</td>
                                                        <td className="agent-col">
                                                            <div className="agent-cell-name">
                                                                {agent?.profile_image ? (
                                                                    <img src={agent.profile_image} alt="Avatar" className="leaderboard-avatar" />
                                                                ) : (
                                                                    <div className="leaderboard-avatar-placeholder">👮</div>
                                                                )}
                                                                <span>{agentName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="time-col">{scoreObj.score} pts</td>
                                                        <td className="mode-col">{scoreObj.speed_mode || 'Normal'}</td>
                                                        <td className="date-col">{new Date(scoreObj.created_at).toLocaleDateString(currentLanguage === 'es' ? 'es-ES' : 'en-US')}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
