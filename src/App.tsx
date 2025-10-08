import React, { useEffect, useRef } from 'react';
import { Game } from './game/Game';

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = new Game(canvas);
    gameRef.current = game;
    game.start();

    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="app-shell">
      <canvas ref={canvasRef} width={640} height={360} />
    </div>
  );
};
