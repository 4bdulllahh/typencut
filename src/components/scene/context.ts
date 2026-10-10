"use client";

import { createContext, useContext } from "react";
import type { GameEngine } from "@/game/engine";
import type { Weather } from "@/game/types";

export const EngineCtx = createContext<GameEngine>(null!);
export const useEngine = () => useContext(EngineCtx);

export const NightCtx = createContext(false);
export const useNight = () => useContext(NightCtx);

export const WeatherCtx = createContext<Weather>("clear");
export const useWeather = () => useContext(WeatherCtx);
