/* eslint-disable react/prop-types */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';

const DIFFICULTIES = {
    Easy: { rows: 9, cols: 9, mines: 10, label: 'msEasy' },
    Medium: { rows: 12, cols: 12, mines: 22, label: 'msMedium' },
    Hard: { rows: 15, cols: 15, mines: 40, label: 'msHard' }
};

export default function MinesweeperModal({ onClose, profile }) {
    const { t, currentLanguage } = useLanguage();
    const [activeTab, setActiveTab] = useState('game'); // 'game' | 'leaderboard'
    const [selectedDifficulty, setSelectedDifficulty] = useState('Easy');
    const [board, setBoard] = useState([]);
    const [gameStatus, setGameStatus] = useState('idle'); // 'idle' | 'playing' | 'won' | 'lost'
    const [timer, setTimer] = useState(0);
    const [minesLeft, setMinesLeft] = useState(DIFFICULTIES.Easy.mines);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
    const [scoreSaving, setScoreSaving] = useState(false);

    const timerRef = useRef(null);

    const initBoard = useCallback(() => {
        const { rows, cols, mines } = DIFFICULTIES[selectedDifficulty];
        const newBoard = [];
        for (let r = 0; r < rows; r++) {
            const row = [];
            for (let c = 0; c < cols; c++) {
                row.push({
                    x: r,
                    y: c,
                    isMine: false,
                    isRevealed: false,
                    isFlagged: false,
                    neighborMines: 0,
                    exploded: false
                });
            }
            newBoard.push(row);
        }
        setBoard(newBoard);
        setGameStatus('idle');
        setTimer(0);
        setMinesLeft(mines);
    }, [selectedDifficulty]);

    const fetchLeaderboard = useCallback(async () => {
        setLoadingLeaderboard(true);
        try {
            const { data, error } = await supabase
                .from('minesweeper_scores')
                .select('*, user:user_id(id, nombre, apellido, rango, no_placa, profile_image)')
                .eq('difficulty', selectedDifficulty)
                .order('time_seconds', { ascending: true })
                .limit(20);

            if (error) {
                console.error('Error fetching leaderboard:', error);
            } else {
                setLeaderboard(data || []);
            }
        } catch (err) {
            console.error('Failed to fetch leaderboard:', err);
        } finally {
            setLoadingLeaderboard(false);
        }
    }, [selectedDifficulty]);

    // Initialize board on difficulty change
    useEffect(() => {
        initBoard();
    }, [initBoard]);

    // Timer effect
    useEffect(() => {
        if (gameStatus === 'playing') {
            timerRef.current = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameStatus]);

    // Fetch leaderboard when leaderboard tab is active
    useEffect(() => {
        if (activeTab === 'leaderboard') {
            fetchLeaderboard();
        }
    }, [activeTab, fetchLeaderboard]);

    const generateMines = (clickedRow, clickedCol) => {
        const { rows, cols, mines } = DIFFICULTIES[selectedDifficulty];
        const newBoard = JSON.parse(JSON.stringify(board));
        
        let minesPlaced = 0;
        while (minesPlaced < mines) {
            const r = Math.floor(Math.random() * rows);
            const c = Math.floor(Math.random() * cols);

            // Avoid placing mine on first clicked cell, neighbors, or already-mined cells
            const isFirstClickOrNeighbor = Math.abs(r - clickedRow) <= 1 && Math.abs(c - clickedCol) <= 1;
            if (!newBoard[r][c].isMine && !isFirstClickOrNeighbor) {
                newBoard[r][c].isMine = true;
                minesPlaced++;
            }
        }

        // Calculate neighbors
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!newBoard[r][c].isMine) {
                    let count = 0;
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            const nr = r + dr;
                            const nc = c + dc;
                            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                                if (newBoard[nr][nc].isMine) count++;
                            }
                        }
                    }
                    newBoard[r][c].neighborMines = count;
                }
            }
        }

        return newBoard;
    };

    const saveScore = async (finalTime) => {
        if (!profile) return;
        setScoreSaving(true);
        try {
            const { error } = await supabase
                .from('minesweeper_scores')
                .insert({
                    user_id: profile.id,
                    time_seconds: finalTime,
                    difficulty: selectedDifficulty
                });

            if (error) {
                console.error('Error saving score:', error);
            }
        } catch (err) {
            console.error('Failed to save score:', err);
        } finally {
            setScoreSaving(false);
        }
    };

    const handleCellClick = async (row, col) => {
        if (gameStatus === 'lost' || gameStatus === 'won') return;

        let currentBoard = board;
        let isFirstClick = gameStatus === 'idle';

        if (isFirstClick) {
            currentBoard = generateMines(row, col);
            setGameStatus('playing');
        }

        const cell = currentBoard[row][col];
        if (cell.isRevealed || cell.isFlagged) return;

        const updatedBoard = JSON.parse(JSON.stringify(currentBoard));
        revealCell(updatedBoard, row, col);

        // Check loss
        if (updatedBoard[row][col].isMine) {
            revealAllMines(updatedBoard, row, col);
            setBoard(updatedBoard);
            setGameStatus('lost');
            return;
        }

        // Check win
        if (checkWinCondition(updatedBoard)) {
            setBoard(updatedBoard);
            setGameStatus('won');
            await saveScore(timer);
        } else {
            setBoard(updatedBoard);
        }
    };

    const handleRightClick = (e, row, col) => {
        e.preventDefault();
        if (gameStatus === 'lost' || gameStatus === 'won' || gameStatus === 'idle') return;

        const cell = board[row][col];
        if (cell.isRevealed) return;

        const newBoard = [...board];
        newBoard[row][col].isFlagged = !newBoard[row][col].isFlagged;
        setBoard(newBoard);

        const currentMinesLimit = DIFFICULTIES[selectedDifficulty].mines;
        const flaggedCount = newBoard.flat().filter(c => c.isFlagged).length;
        setMinesLeft(currentMinesLimit - flaggedCount);
    };

    const revealCell = (grid, r, c) => {
        const { rows, cols } = DIFFICULTIES[selectedDifficulty];
        if (r < 0 || r >= rows || c < 0 || c >= cols) return;

        const cell = grid[r][c];
        if (cell.isRevealed || cell.isFlagged) return;

        cell.isRevealed = true;

        if (cell.neighborMines === 0 && !cell.isMine) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    revealCell(grid, r + dr, c + dc);
                }
            }
        }
    };

    const revealAllMines = (grid, clickedRow, clickedCol) => {
        grid.forEach(row => {
            row.forEach(cell => {
                if (cell.isMine) {
                    cell.isRevealed = true;
                    if (cell.x === clickedRow && cell.y === clickedCol) {
                        cell.exploded = true;
                    }
                }
            });
        });
    };

    const checkWinCondition = (grid) => {
        return grid.every(row => 
            row.every(cell => 
                (cell.isMine && !cell.isRevealed) || (!cell.isMine && cell.isRevealed)
            )
        );
    };

    // Render smile face
    const getFaceIcon = () => {
        if (gameStatus === 'won') return '😎';
        if (gameStatus === 'lost') return '😵';
        if (gameStatus === 'playing') return '😮';
        return '😊';
    };

    const formatTime = (secs) => {
        if (secs >= 999) return '999';
        return String(secs).padStart(3, '0');
    };

    return (
        <div className="cropper-modal-overlay ms-modal-overlay">
            <div className="cropper-modal-content ms-modal-content">
                <div className="ms-modal-header">
                    <h3 className="ms-modal-title">👾 {t('msTitle')}</h3>
                    <button className="ms-close-btn" onClick={onClose}>✕</button>
                </div>

                {/* Tabs */}
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

                {/* Main Content Area */}
                <div className="ms-modal-body">
                    {activeTab === 'game' ? (
                        <div className="ms-game-view">
                            {/* Controls */}
                            <div className="ms-game-controls">
                                <div className="ms-difficulty-selector">
                                    {Object.keys(DIFFICULTIES).map((diff) => (
                                        <button
                                            key={diff}
                                            className={`ms-diff-btn ${selectedDifficulty === diff ? 'active' : ''}`}
                                            onClick={() => {
                                                setSelectedDifficulty(diff);
                                            }}
                                        >
                                            {t(DIFFICULTIES[diff].label)}
                                        </button>
                                    ))}
                                </div>

                                <div className="ms-stats-bar">
                                    <div className="ms-stat-counter" title="Mines Remaining">
                                        🚩 {String(Math.max(0, minesLeft)).padStart(3, '0')}
                                    </div>
                                    <button className="ms-reset-btn" onClick={initBoard} disabled={scoreSaving}>
                                        {getFaceIcon()}
                                    </button>
                                    <div className="ms-stat-counter" title="Time Elapsed">
                                        ⏱️ {formatTime(timer)}
                                    </div>
                                </div>
                            </div>

                            {/* Game Info Message */}
                            {gameStatus === 'won' && (
                                <div className="ms-alert ms-alert-success">
                                    🎉 {scoreSaving ? `${t('msWin')} (Saving...)` : t('msWin')} {timer}s.
                                </div>
                            )}
                            {gameStatus === 'lost' && (
                                <div className="ms-alert ms-alert-danger">
                                    💥 {t('msGameOver')}
                                </div>
                            )}

                            {/* Grid Container */}
                            <div className="ms-board-outer">
                                <div 
                                    className={`ms-board ms-board-${selectedDifficulty.toLowerCase()}`}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: `repeat(${DIFFICULTIES[selectedDifficulty].cols}, 1fr)`,
                                        gap: '2px'
                                    }}
                                >
                                    {board.map((row, rIdx) => 
                                        row.map((cell, cIdx) => {
                                            let cellClass = 'ms-cell';
                                            let cellContent = '';

                                            if (cell.isRevealed) {
                                                cellClass += ' revealed';
                                                if (cell.isMine) {
                                                    cellClass += cell.exploded ? ' exploded' : ' mine';
                                                    cellContent = '💣';
                                                } else if (cell.neighborMines > 0) {
                                                    cellClass += ` count-${cell.neighborMines}`;
                                                    cellContent = cell.neighborMines;
                                                }
                                            } else if (cell.isFlagged) {
                                                cellClass += ' flagged';
                                                cellContent = '🚩';
                                            }

                                            return (
                                                <button
                                                    key={`${rIdx}-${cIdx}`}
                                                    className={cellClass}
                                                    onClick={() => handleCellClick(rIdx, cIdx)}
                                                    onContextMenu={(e) => handleRightClick(e, rIdx, cIdx)}
                                                >
                                                    {cellContent}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                            
                            <div className="ms-game-footer">
                                <small>🖱️ Click: Revelar | 🚩 Right-Click: Bandera</small>
                            </div>
                        </div>
                    ) : (
                        <div className="ms-leaderboard-view">
                            <div className="ms-difficulty-selector">
                                {Object.keys(DIFFICULTIES).map((diff) => (
                                    <button
                                        key={diff}
                                        className={`ms-diff-btn ${selectedDifficulty === diff ? 'active' : ''}`}
                                        onClick={() => setSelectedDifficulty(diff)}
                                    >
                                        {t(DIFFICULTIES[diff].label)}
                                    </button>
                                ))}
                            </div>

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
                                                <th>{t('msTime')}</th>
                                                <th>{t('msDate')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {leaderboard.map((score, index) => {
                                                const agent = score.user;
                                                const agentName = agent 
                                                    ? `${agent.rango || ''} ${agent.nombre || ''} ${agent.apellido || ''} (${agent.no_placa || '?'})`
                                                    : 'Unknown Agent';
                                                const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
                                                
                                                return (
                                                    <tr key={score.id} className={agent?.id === profile?.id ? 'current-user-row' : ''}>
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
                                                        <td className="time-col">{score.time_seconds}s</td>
                                                        <td className="date-col">{new Date(score.created_at).toLocaleDateString(currentLanguage === 'es' ? 'es-ES' : 'en-US')}</td>
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
