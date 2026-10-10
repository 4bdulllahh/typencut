"use client";

import { createContext, useContext } from "react";
import type { GameEngine } from "@/game/engine";

export const EngineCtx = createContext<GameEngine>(null!);
export const useEngine = () => useContext(EngineCtx);

export const NightCtx = createContext(false);
export const useNight = () => useContext(NightCtx);
