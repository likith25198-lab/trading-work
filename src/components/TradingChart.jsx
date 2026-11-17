import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
  CrosshairMode,
} from 'lightweight-charts';
import {
  MousePointer,
  Slash,
  Minus,
  Eraser,
  Undo2,
  Trash2,
} from 'lucide-react';
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateVWAP,
  calculateStochastic,
  calculateATR,
  calculatePivotPoints,
} from '../utils/indicators';
import { detectCandlestickPatterns } from '../utils/candlestickPatterns';
import { formatNumber } from '../utils/formatters';

const CHART_COLORS = {
  background: '#0a0e17',
  grid: '#161e30',
  text: '#94a3b8',
  border: '#2a3550',
  up: '#10b981',
  down: '#ef4444',
  sma20: '#3b82f6',
  sma50: '#f59e0b',
  ema12: '#06b6d4',
  ema26: '#ec4899',
  bbUpper: '#8b5cf6',
  bbMiddle: '#a78bfa',
  bbLower: '#8b5cf6',
  vwap: '#f43f5e',
};

function toSeriesPoints(candles, values) {
  const pts = [];
  for (let i = 0; i < candles.length; i++) {
    if (values[i] !== null && values[i] !== undefined && !Number.isNaN(values[i])) {
      pts.push({ time: candles[i].time, value: values[i] });
    }
  }
  return pts;
}

export default function TradingChart({
  symbol,
  visibleData,
  activeOverlays,
  activeOscillator,
  orders,
  selectedTimeframe = '5m',
  showPatterns = false,
}) {
  const mainContainerRef = useRef(null);
  const oscContainerRef = useRef(null);

  const mainChartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const markersPluginRef = useRef(null);
  const overlaySeriesRef = useRef({});
  const pivotLinesRef = useRef([]);

  const oscChartRef = useRef(null);
  const oscSeriesRef = useRef([]);

  const prevSymbolRef = useRef(symbol);
  const prevTimeframeRef = useRef(selectedTimeframe);
  const prevLenRef = useRef(0);
  const prevOscTypeRef = useRef(null);

  const [hoveredCandle, setHoveredCandle] = useState(null);
  const [chartApi, setChartApi] = useState(null);
  const [candleSeriesApi, setCandleSeriesApi] = useState(null);
  const [userToggledPatterns, setUserToggledPatterns] = useState(null);
  const patternsEnabled = userToggledPatterns !== null ? userToggledPatterns : showPatterns;

  const latestCandle = visibleData[visibleData.length - 1] || null;
  const displayCandle = hoveredCandle || latestCandle;

  // Drawing tools state
  const [drawingsBySymbol, setDrawingsBySymbol] = useState({});
  const [drawingTool, setDrawingTool] = useState('cursor'); // 'cursor' | 'trendline' | 'horizontal' | 'eraser'
  const [drawingColor, setDrawingColor] = useState('#f59e0b');
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [draftPoint, setDraftPoint] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const [chartDims, setChartDims] = useState({ width: 800, height: 400 });
  const [, setRangeTick] = useState(0);

  const currentDrawings = drawingsBySymbol[symbol] || [];

  // Escape key cancels draft or reverts to cursor
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (draftPoint) {
          setDraftPoint(null);
        } else {
          setDrawingTool('cursor');
          setShowColorPalette(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draftPoint]);

  // Initialize main candlestick + volume chart
  useEffect(() => {
    const container = mainContainerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { color: CHART_COLORS.background },
        textColor: CHART_COLORS.text,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid },
        horzLines: { color: CHART_COLORS.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#475569', labelBackgroundColor: '#1e293b' },
        horzLine: { color: '#475569', labelBackgroundColor: '#1e293b' },
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.up,
      downColor: CHART_COLORS.down,
      borderUpColor: CHART_COLORS.up,
      borderDownColor: CHART_COLORS.down,
      wickUpColor: CHART_COLORS.up,
      wickDownColor: CHART_COLORS.down,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    const markersPlugin = createSeriesMarkers(candleSeries, []);

    mainChartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    markersPluginRef.current = markersPlugin;
    setChartApi(chart);
    setCandleSeriesApi(candleSeries);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
          setChartDims({ width, height });
        }
      }
    });
    ro.observe(container);

    const onRangeChange = () => setRangeTick((t) => t + 1);
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

    return () => {
      ro.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      overlaySeriesRef.current = {};
      pivotLinesRef.current = [];
      chart.remove();
      mainChartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      markersPluginRef.current = null;
      setChartApi(null);
      setCandleSeriesApi(null);
    };
  }, []);

  // Crosshair hover OHLCV readout
  useEffect(() => {
    const chart = mainChartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries) return;

    const handler = (param) => {
      if (!param.time || !param.seriesData) {
        setHoveredCandle(null);
        return;
      }
      const match = visibleData.find((d) => d.time === param.time);
      setHoveredCandle(match || null);
    };

    chart.subscribeCrosshairMove(handler);
    return () => chart.unsubscribeCrosshairMove(handler);
  }, [visibleData]);

  // Update main chart data, overlays, pivots, and trade markers
  useEffect(() => {
    const chart = mainChartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !volumeSeries || visibleData.length === 0) return;

    // 1. Candlesticks & Volume
    candleSeries.setData(
      visibleData.map((d) => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    volumeSeries.setData(
      visibleData.map((d) => ({
        time: d.time,
        value: d.volume,
        color:
          d.close >= d.open ? 'rgba(16, 185, 129, 0.32)' : 'rgba(239, 68, 68, 0.32)',
      }))
    );

    // 2. Overlay Line Series management
    const ensureLine = (key, options) => {
      if (!overlaySeriesRef.current[key]) {
        overlaySeriesRef.current[key] = chart.addSeries(LineSeries, {
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          ...options,
        });
      }
      return overlaySeriesRef.current[key];
    };

    const removeLine = (key) => {
      if (overlaySeriesRef.current[key]) {
        chart.removeSeries(overlaySeriesRef.current[key]);
        delete overlaySeriesRef.current[key];
      }
    };

    if (activeOverlays.includes('SMA20')) {
      const vals = calculateSMA(visibleData, 20);
      ensureLine('SMA20', { color: CHART_COLORS.sma20, lineWidth: 2, title: 'SMA 20' }).setData(
        toSeriesPoints(visibleData, vals)
      );
    } else {
      removeLine('SMA20');
    }

    if (activeOverlays.includes('SMA50')) {
      const vals = calculateSMA(visibleData, 50);
      ensureLine('SMA50', { color: CHART_COLORS.sma50, lineWidth: 2, title: 'SMA 50' }).setData(
        toSeriesPoints(visibleData, vals)
      );
    } else {
      removeLine('SMA50');
    }

    if (activeOverlays.includes('EMA12')) {
      const vals = calculateEMA(visibleData, 12);
      ensureLine('EMA12', { color: CHART_COLORS.ema12, lineWidth: 1.5, title: 'EMA 12' }).setData(
        toSeriesPoints(visibleData, vals)
      );
    } else {
      removeLine('EMA12');
    }

    if (activeOverlays.includes('EMA26')) {
      const vals = calculateEMA(visibleData, 26);
      ensureLine('EMA26', { color: CHART_COLORS.ema26, lineWidth: 1.5, title: 'EMA 26' }).setData(
        toSeriesPoints(visibleData, vals)
      );
    } else {
      removeLine('EMA26');
    }

    if (activeOverlays.includes('BB')) {
      const bb = calculateBollingerBands(visibleData, 20, 2);
      ensureLine('BB_UP', {
        color: CHART_COLORS.bbUpper,
        lineWidth: 1,
        lineStyle: 2,
        title: 'BB Upper',
      }).setData(toSeriesPoints(visibleData, bb.upper));
      ensureLine('BB_MID', {
        color: CHART_COLORS.bbMiddle,
        lineWidth: 1,
        lineStyle: 1,
        title: 'BB Mid',
      }).setData(toSeriesPoints(visibleData, bb.middle));
      ensureLine('BB_LOW', {
        color: CHART_COLORS.bbLower,
        lineWidth: 1,
        lineStyle: 2,
        title: 'BB Lower',
      }).setData(toSeriesPoints(visibleData, bb.lower));
    } else {
      removeLine('BB_UP');
      removeLine('BB_MID');
      removeLine('BB_LOW');
    }

    if (activeOverlays.includes('VWAP')) {
      const vwap = calculateVWAP(visibleData);
      ensureLine('VWAP', { color: CHART_COLORS.vwap, lineWidth: 2, title: 'VWAP' }).setData(
        toSeriesPoints(visibleData, vwap)
      );
    } else {
      removeLine('VWAP');
    }

    // 3. Pivot Points (Support & Resistance)
    for (const line of pivotLinesRef.current) {
      candleSeries.removePriceLine(line);
    }
    pivotLinesRef.current = [];

    if (activeOverlays.includes('PIVOTS') && visibleData.length >= 2) {
      const pivots = calculatePivotPoints(visibleData, visibleData.length - 1);
      if (pivots) {
        const defs = [
          { price: pivots.r1, color: 'rgba(239, 68, 68, 0.7)', title: 'R1 (Res)' },
          { price: pivots.pivot, color: 'rgba(148, 163, 184, 0.65)', title: 'Pivot' },
          { price: pivots.s1, color: 'rgba(16, 185, 129, 0.7)', title: 'S1 (Sup)' },
        ];
        pivotLinesRef.current = defs.map((d) =>
          candleSeries.createPriceLine({
            price: d.price,
            color: d.color,
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: d.title,
          })
        );
      }
    }

    // 4. Trade Markers & Candlestick Patterns on Candles
    if (markersPluginRef.current) {
      const maxTime = visibleData[visibleData.length - 1].time;
      const minTime = visibleData[0].time;
      const stockMarkers = orders
        .filter((o) => o.symbol === symbol && o.candleTime >= minTime && o.candleTime <= maxTime)
        .sort((a, b) => a.candleTime - b.candleTime)
        .map((o) => ({
          time: o.candleTime,
          position: o.type === 'BUY' ? 'belowBar' : 'aboveBar',
          color: o.type === 'BUY' ? '#10b981' : '#ef4444',
          shape: o.type === 'BUY' ? 'arrowUp' : 'arrowDown',
          text: `${o.type} ${o.qty}`,
        }));

      let patternMarkers = [];
      if (patternsEnabled && visibleData.length >= 3) {
        // Detect patterns on the most recent 60 candles so chart stays clear and readable
        const detected = detectCandlestickPatterns(
          visibleData,
          Math.max(0, visibleData.length - 60)
        );
        patternMarkers = detected.map((p) => ({
          time: p.time,
          position:
            p.type === 'BULLISH'
              ? 'belowBar'
              : p.type === 'BEARISH'
              ? 'aboveBar'
              : 'belowBar',
          color: p.color,
          shape:
            p.type === 'BULLISH'
              ? 'arrowUp'
              : p.type === 'BEARISH'
              ? 'arrowDown'
              : 'circle',
          text: `${p.icon} ${p.name}`,
        }));
      }

      const allMarkers = [...stockMarkers, ...patternMarkers].sort(
        (a, b) => a.time - b.time
      );
      markersPluginRef.current.setMarkers(allMarkers);
    }

    // Fit content on symbol or timeframe change or reset
    if (
      prevSymbolRef.current !== symbol ||
      prevTimeframeRef.current !== selectedTimeframe ||
      visibleData.length < prevLenRef.current
    ) {
      chart.timeScale().fitContent();
    } else if (visibleData.length > prevLenRef.current) {
      chart.timeScale().scrollToRealTime();
    }
    prevSymbolRef.current = symbol;
    prevTimeframeRef.current = selectedTimeframe;
    prevLenRef.current = visibleData.length;
  }, [symbol, selectedTimeframe, visibleData, activeOverlays, orders, patternsEnabled]);

  // Initialize and update oscillator sub-chart (RSI / MACD / STOCH / ATR)
  useEffect(() => {
    const container = oscContainerRef.current;
    if (!activeOscillator || !container) {
      if (oscChartRef.current) {
        oscChartRef.current.remove();
        oscChartRef.current = null;
        oscSeriesRef.current = [];
      }
      return;
    }

    const oscChart = createChart(container, {
      layout: {
        background: { color: CHART_COLORS.background },
        textColor: CHART_COLORS.text,
        fontSize: 10,
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid },
        horzLines: { color: CHART_COLORS.grid },
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
      },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
    });

    oscChartRef.current = oscChart;

    // Sync timeScale with main chart
    const mainChart = mainChartRef.current;
    let isSyncing = false;

    const syncMainToOsc = (range) => {
      if (isSyncing || !range) return;
      isSyncing = true;
      try {
        oscChart.timeScale().setVisibleLogicalRange(range);
      } catch {
        // ignore out-of-range during initial mount
      }
      isSyncing = false;
    };

    const syncOscToMain = (range) => {
      if (isSyncing || !range || !mainChart) return;
      isSyncing = true;
      try {
        mainChart.timeScale().setVisibleLogicalRange(range);
      } catch {
        // ignore
      }
      isSyncing = false;
    };

    if (mainChart) {
      mainChart.timeScale().subscribeVisibleLogicalRangeChange(syncMainToOsc);
      oscChart.timeScale().subscribeVisibleLogicalRangeChange(syncOscToMain);
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          oscChart.applyOptions({ width, height });
        }
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      if (mainChart) {
        mainChart.timeScale().unsubscribeVisibleLogicalRangeChange(syncMainToOsc);
      }
      oscChart.remove();
      oscChartRef.current = null;
      oscSeriesRef.current = [];
    };
  }, [activeOscillator]);

  // Populate oscillator series data whenever visibleData or activeOscillator changes
  useEffect(() => {
    const oscChart = oscChartRef.current;
    if (!oscChart || !activeOscillator || visibleData.length === 0) return;

    const oscTypeChanged = prevOscTypeRef.current !== activeOscillator || oscSeriesRef.current.length === 0;

    if (oscTypeChanged) {
      // Clear previous series only when the oscillator type changes
      for (const s of oscSeriesRef.current) {
        try {
          oscChart.removeSeries(s);
        } catch {
          // already removed
        }
      }
      oscSeriesRef.current = [];
      prevOscTypeRef.current = activeOscillator;
    }

    if (activeOscillator === 'RSI') {
      const rsi = calculateRSI(visibleData, 14);
      const points = toSeriesPoints(visibleData, rsi);

      if (oscTypeChanged) {
        const rsiSeries = oscChart.addSeries(LineSeries, {
          color: '#f59e0b',
          lineWidth: 2,
          title: 'RSI (14)',
        });
        rsiSeries.setData(points);
        rsiSeries.createPriceLine({
          price: 70,
          color: 'rgba(239, 68, 68, 0.55)',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'OB 70',
        });
        rsiSeries.createPriceLine({
          price: 30,
          color: 'rgba(16, 185, 129, 0.55)',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'OS 30',
        });
        oscSeriesRef.current = [rsiSeries];
      } else if (oscSeriesRef.current[0]) {
        oscSeriesRef.current[0].setData(points);
      }
    } else if (activeOscillator === 'MACD') {
      const { macdLine, signalLine, histogram } = calculateMACD(visibleData, 12, 26, 9);
      const histPoints = [];
      for (let i = 0; i < visibleData.length; i++) {
        if (histogram[i] !== null) {
          histPoints.push({
            time: visibleData[i].time,
            value: histogram[i],
            color:
              histogram[i] >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)',
          });
        }
      }
      const macdPoints = toSeriesPoints(visibleData, macdLine);
      const sigPoints = toSeriesPoints(visibleData, signalLine);

      if (oscTypeChanged) {
        const histSeries = oscChart.addSeries(HistogramSeries, {
          title: 'Histogram',
        });
        histSeries.setData(histPoints);

        const macdSeries = oscChart.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 2,
          title: 'MACD',
        });
        macdSeries.setData(macdPoints);

        const sigSeries = oscChart.addSeries(LineSeries, {
          color: '#f97316',
          lineWidth: 1.5,
          title: 'Signal',
        });
        sigSeries.setData(sigPoints);

        oscSeriesRef.current = [histSeries, macdSeries, sigSeries];
      } else {
        if (oscSeriesRef.current[0]) oscSeriesRef.current[0].setData(histPoints);
        if (oscSeriesRef.current[1]) oscSeriesRef.current[1].setData(macdPoints);
        if (oscSeriesRef.current[2]) oscSeriesRef.current[2].setData(sigPoints);
      }
    } else if (activeOscillator === 'STOCH') {
      const { k, d } = calculateStochastic(visibleData, 14, 3);
      const kPoints = toSeriesPoints(visibleData, k);
      const dPoints = toSeriesPoints(visibleData, d);

      if (oscTypeChanged) {
        const kSeries = oscChart.addSeries(LineSeries, {
          color: '#38bdf8',
          lineWidth: 2,
          title: '%K',
        });
        kSeries.setData(kPoints);
        kSeries.createPriceLine({
          price: 80,
          color: 'rgba(239, 68, 68, 0.5)',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: '80',
        });
        kSeries.createPriceLine({
          price: 20,
          color: 'rgba(16, 185, 129, 0.5)',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: '20',
        });

        const dSeries = oscChart.addSeries(LineSeries, {
          color: '#f43f5e',
          lineWidth: 1.5,
          title: '%D',
        });
        dSeries.setData(dPoints);

        oscSeriesRef.current = [kSeries, dSeries];
      } else {
        if (oscSeriesRef.current[0]) oscSeriesRef.current[0].setData(kPoints);
        if (oscSeriesRef.current[1]) oscSeriesRef.current[1].setData(dPoints);
      }
    } else if (activeOscillator === 'ATR') {
      const atr = calculateATR(visibleData, 14);
      const atrPoints = toSeriesPoints(visibleData, atr);

      if (oscTypeChanged) {
        const atrSeries = oscChart.addSeries(LineSeries, {
          color: '#a78bfa',
          lineWidth: 2,
          title: 'ATR (14)',
        });
        atrSeries.setData(atrPoints);
        oscSeriesRef.current = [atrSeries];
      } else if (oscSeriesRef.current[0]) {
        oscSeriesRef.current[0].setData(atrPoints);
      }
    }

    // Align oscillator range with main chart
    if (mainChartRef.current) {
      const range = mainChartRef.current.timeScale().getVisibleLogicalRange();
      if (range) {
        try {
          oscChart.timeScale().setVisibleLogicalRange(range);
        } catch {
          // ignore
        }
      }
    }
  }, [visibleData, activeOscillator]);

  const DRAWING_COLORS = [
    { id: '#f59e0b', label: 'Amber' },
    { id: '#10b981', label: 'Green (Support)' },
    { id: '#ef4444', label: 'Red (Resistance)' },
    { id: '#38bdf8', label: 'Cyan' },
    { id: '#e2e8f0', label: 'White' },
  ];

  const getCoordinatesFromEvent = (e) => {
    const container = mainContainerRef.current;
    const chart = mainChartRef.current;
    const series = candleSeriesRef.current;
    if (!container || !chart || !series) return null;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const price = series.coordinateToPrice(y);
    const logical = chart.timeScale().coordinateToLogical(x);
    const time = chart.timeScale().coordinateToTime(x);

    return { x, y, price, logical, time };
  };

  const priceToY = useCallback(
    (price) => {
      return candleSeriesApi?.priceToCoordinate(price) ?? null;
    },
    [candleSeriesApi]
  );

  const toScreenPoint = useCallback(
    (pt) => {
      if (!chartApi || !candleSeriesApi || !pt) return null;

      let x = null;
      if (pt.time) {
        x = chartApi.timeScale().timeToCoordinate(pt.time);
      }
      if (x === null && pt.logical !== null && pt.logical !== undefined) {
        x = chartApi.timeScale().logicalToCoordinate(pt.logical);
      }
      const y = candleSeriesApi.priceToCoordinate(pt.price);

      if (x === null || y === null) return null;
      return { x, y };
    },
    [chartApi, candleSeriesApi]
  );

  const handleSvgMouseDown = (e) => {
    if (drawingTool === 'cursor') return;
    const coords = getCoordinatesFromEvent(e);
    if (!coords || coords.price === null) return;

    if (drawingTool === 'horizontal') {
      const newDrawing = {
        id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'horizontal',
        price: coords.price,
        color: drawingColor,
      };
      setDrawingsBySymbol((prev) => ({
        ...prev,
        [symbol]: [...(prev[symbol] || []), newDrawing],
      }));
    } else if (drawingTool === 'trendline') {
      if (!draftPoint) {
        setDraftPoint(coords);
      } else {
        const newDrawing = {
          id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'trendline',
          p1: { price: draftPoint.price, logical: draftPoint.logical, time: draftPoint.time },
          p2: { price: coords.price, logical: coords.logical, time: coords.time },
          color: drawingColor,
        };
        setDrawingsBySymbol((prev) => ({
          ...prev,
          [symbol]: [...(prev[symbol] || []), newDrawing],
        }));
        setDraftPoint(null);
      }
    }
  };

  const handleSvgMouseMove = (e) => {
    if (drawingTool === 'cursor') return;
    const coords = getCoordinatesFromEvent(e);
    setMousePos(coords);
  };

  const handleSvgMouseLeave = () => {
    setMousePos(null);
  };

  const handleUndo = () => {
    setDrawingsBySymbol((prev) => {
      const list = prev[symbol] || [];
      return {
        ...prev,
        [symbol]: list.slice(0, -1),
      };
    });
    setDraftPoint(null);
  };

  const handleClear = () => {
    setDrawingsBySymbol((prev) => ({
      ...prev,
      [symbol]: [],
    }));
    setDraftPoint(null);
  };

  const deleteDrawing = (id, e) => {
    if (e) e.stopPropagation();
    setDrawingsBySymbol((prev) => ({
      ...prev,
      [symbol]: (prev[symbol] || []).filter((d) => d.id !== id),
    }));
  };

  const isDrawingActive = drawingTool !== 'cursor';

  return (
    <div className="chart-area">
      {displayCandle && (
        <div className="ohlcv-bar">
          <div className="ohlcv-item">
            <span className="ohlcv-label">Time</span>
            <span className="ohlcv-value">{displayCandle.displayTime}</span>
          </div>
          <div className="ohlcv-item">
            <span className="ohlcv-label">O</span>
            <span className="ohlcv-value">₹{displayCandle.open.toFixed(2)}</span>
          </div>
          <div className="ohlcv-item">
            <span className="ohlcv-label">H</span>
            <span className="ohlcv-value positive">₹{displayCandle.high.toFixed(2)}</span>
          </div>
          <div className="ohlcv-item">
            <span className="ohlcv-label">L</span>
            <span className="ohlcv-value negative">₹{displayCandle.low.toFixed(2)}</span>
          </div>
          <div className="ohlcv-item">
            <span className="ohlcv-label">C</span>
            <span
              className={`ohlcv-value ${displayCandle.close >= displayCandle.open ? 'positive' : 'negative'
                }`}
            >
              ₹{displayCandle.close.toFixed(2)}
            </span>
          </div>
          <div className="ohlcv-item">
            <span className="ohlcv-label">Vol</span>
            <span className="ohlcv-value">{formatNumber(displayCandle.volume)}</span>
          </div>
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(59, 130, 246, 0.14)',
                color: '#60a5fa',
                fontWeight: 600,
              }}
            >
              Phase: {displayCandle.phase}
            </span>
          </div>
        </div>
      )}

      <div className="chart-container" ref={mainContainerRef}>
        {/* Floating Drawing Tools Bar */}
        <div className="chart-draw-toolbar">
          <button
            type="button"
            className={`draw-tool-btn ${drawingTool === 'cursor' ? 'active' : ''}`}
            title="Cursor / Pan Mode (Esc)"
            onClick={() => {
              setDrawingTool('cursor');
              setDraftPoint(null);
              setShowColorPalette(false);
            }}
          >
            <MousePointer size={15} />
          </button>

          <button
            type="button"
            className={`draw-tool-btn ${drawingTool === 'trendline' ? 'active' : ''}`}
            title="Draw Trendline (Click start, then click end)"
            onClick={() => {
              setDrawingTool('trendline');
              setDraftPoint(null);
              setShowColorPalette(false);
            }}
          >
            <Slash size={15} />
          </button>

          <button
            type="button"
            className={`draw-tool-btn ${drawingTool === 'horizontal' ? 'active' : ''}`}
            title="Draw Horizontal Support / Resistance Level"
            onClick={() => {
              setDrawingTool('horizontal');
              setDraftPoint(null);
              setShowColorPalette(false);
            }}
          >
            <Minus size={15} />
          </button>

          <button
            type="button"
            className={`draw-tool-btn ${drawingTool === 'eraser' ? 'active' : ''}`}
            title="Eraser (Click any line to delete)"
            onClick={() => {
              setDrawingTool('eraser');
              setDraftPoint(null);
              setShowColorPalette(false);
            }}
          >
            <Eraser size={15} />
          </button>

          <div className="draw-tool-separator" />

          <button
            type="button"
            className="draw-tool-btn"
            title="Line Color"
            onClick={() => setShowColorPalette((s) => !s)}
            style={{ position: 'relative' }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: drawingColor,
                boxShadow: '0 0 4px rgba(0,0,0,0.5)',
              }}
            />
          </button>

          {showColorPalette && (
            <div className="color-palette-popup">
              {DRAWING_COLORS.map((c) => (
                <div
                  key={c.id}
                  className={`color-dot ${drawingColor === c.id ? 'active' : ''}`}
                  style={{ background: c.id }}
                  title={c.label}
                  onClick={() => {
                    setDrawingColor(c.id);
                    setShowColorPalette(false);
                  }}
                />
              ))}
            </div>
          )}

          <div className="draw-tool-separator" />

          <button
            type="button"
            className="draw-tool-btn"
            title="Undo Last Line"
            disabled={currentDrawings.length === 0}
            style={{ opacity: currentDrawings.length === 0 ? 0.35 : 1 }}
            onClick={handleUndo}
          >
            <Undo2 size={14} />
          </button>

          <button
            type="button"
            className="draw-tool-btn"
            title="Clear All Lines on this stock"
            disabled={currentDrawings.length === 0}
            style={{ opacity: currentDrawings.length === 0 ? 0.35 : 1 }}
            onClick={handleClear}
          >
            <Trash2 size={14} />
          </button>

          <div className="draw-tool-separator" />

          <button
            type="button"
            className={`draw-tool-btn ${patternsEnabled ? 'active' : ''}`}
            title="Toggle Candlestick Pattern Badges on Candles (Hammers, Engulfing, Stars, Doji)"
            onClick={() => setUserToggledPatterns((p) => (p !== null ? !p : !showPatterns))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              padding: '0 8px',
              color: patternsEnabled ? '#10b981' : '#94a3b8',
              fontWeight: 600,
            }}
          >
            <span>✨</span>
            <span>Patterns</span>
          </button>
        </div>

        {isDrawingActive && (
          <div className="drawing-badge-hint">
            <span>
              {drawingTool === 'trendline' &&
                (draftPoint
                  ? 'Click second point to finish trendline (Esc to cancel)'
                  : 'Trendline: Click starting point on chart')}
              {drawingTool === 'horizontal' &&
                'Horizontal Level: Click anywhere on chart to place support/resistance'}
              {drawingTool === 'eraser' && 'Eraser Active: Click any line to delete it'}
            </span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>
              ({currentDrawings.length} lines on {symbol})
            </span>
          </div>
        )}

        {/* SVG Drawing Layer */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 15,
            pointerEvents: isDrawingActive ? 'auto' : 'none',
            cursor:
              drawingTool === 'trendline' || drawingTool === 'horizontal'
                ? 'crosshair'
                : drawingTool === 'eraser'
                  ? 'pointer'
                  : 'default',
          }}
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={handleSvgMouseLeave}
        >
          {/* Render Stored Drawings */}
          {currentDrawings.map((d) => {
            if (d.type === 'horizontal') {
              const y = priceToY(d.price);
              if (y === null || y === undefined || y < 0 || y > chartDims.height)
                return null;

              return (
                <g
                  key={d.id}
                  onClick={(e) => drawingTool === 'eraser' && deleteDrawing(d.id, e)}
                >
                  {/* Invisible wide hit area for eraser */}
                  <line
                    x1={0}
                    y1={y}
                    x2={chartDims.width}
                    y2={y}
                    stroke="transparent"
                    strokeWidth={14}
                    style={{ cursor: drawingTool === 'eraser' ? 'pointer' : 'default' }}
                  />
                  {/* Visual dashed horizontal line */}
                  <line
                    x1={0}
                    y1={y}
                    x2={chartDims.width - 65}
                    y2={y}
                    stroke={d.color}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                  />
                  {/* Price Tag badge on right side */}
                  <rect
                    x={chartDims.width - 62}
                    y={y - 10}
                    width={58}
                    height={20}
                    rx={3}
                    fill={d.color}
                  />
                  <text
                    x={chartDims.width - 33}
                    y={y + 4}
                    fill="#000"
                    fontSize={10}
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    ₹{d.price.toFixed(1)}
                  </text>
                </g>
              );
            }

            if (d.type === 'trendline') {
              const p1Coord = toScreenPoint(d.p1);
              const p2Coord = toScreenPoint(d.p2);
              if (!p1Coord || !p2Coord) return null;

              return (
                <g
                  key={d.id}
                  onClick={(e) => drawingTool === 'eraser' && deleteDrawing(d.id, e)}
                >
                  {/* Wide hit area */}
                  <line
                    x1={p1Coord.x}
                    y1={p1Coord.y}
                    x2={p2Coord.x}
                    y2={p2Coord.y}
                    stroke="transparent"
                    strokeWidth={14}
                    style={{ cursor: drawingTool === 'eraser' ? 'pointer' : 'default' }}
                  />
                  {/* Visual trendline */}
                  <line
                    x1={p1Coord.x}
                    y1={p1Coord.y}
                    x2={p2Coord.x}
                    y2={p2Coord.y}
                    stroke={d.color}
                    strokeWidth={2.5}
                  />
                  <circle
                    cx={p1Coord.x}
                    cy={p1Coord.y}
                    r={4}
                    fill={d.color}
                    stroke="#111827"
                    strokeWidth={1.5}
                  />
                  <circle
                    cx={p2Coord.x}
                    cy={p2Coord.y}
                    r={4}
                    fill={d.color}
                    stroke="#111827"
                    strokeWidth={1.5}
                  />
                </g>
              );
            }

            return null;
          })}

          {/* Live Preview: Horizontal Line Hover */}
          {drawingTool === 'horizontal' && mousePos && mousePos.price !== null && (
            <g pointerEvents="none">
              <line
                x1={0}
                y1={mousePos.y}
                x2={chartDims.width - 65}
                y2={mousePos.y}
                stroke={drawingColor}
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <rect
                x={chartDims.width - 62}
                y={mousePos.y - 10}
                width={58}
                height={20}
                rx={3}
                fill={drawingColor}
                opacity={0.85}
              />
              <text
                x={chartDims.width - 33}
                y={mousePos.y + 4}
                fill="#000"
                fontSize={10}
                fontWeight="700"
                textAnchor="middle"
              >
                ₹{mousePos.price.toFixed(1)}
              </text>
            </g>
          )}

          {/* Live Preview: Trendline Draft */}
          {drawingTool === 'trendline' && draftPoint && mousePos && (
            <g pointerEvents="none">
              <line
                x1={draftPoint.x}
                y1={draftPoint.y}
                x2={mousePos.x}
                y2={mousePos.y}
                stroke={drawingColor}
                strokeWidth={2}
                strokeDasharray="4 3"
              />
              <circle cx={draftPoint.x} cy={draftPoint.y} r={4} fill={drawingColor} />
              <circle cx={mousePos.x} cy={mousePos.y} r={4} fill={drawingColor} />
            </g>
          )}
        </svg>

        {activeOverlays.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 12,
              zIndex: 10,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              pointerEvents: 'none',
            }}
          >
            {activeOverlays.includes('SMA20') && (
              <span className="indicator-tag" style={{ borderColor: CHART_COLORS.sma20 }}>
                <span style={{ color: CHART_COLORS.sma20 }}>●</span> SMA 20
              </span>
            )}
            {activeOverlays.includes('SMA50') && (
              <span className="indicator-tag" style={{ borderColor: CHART_COLORS.sma50 }}>
                <span style={{ color: CHART_COLORS.sma50 }}>●</span> SMA 50
              </span>
            )}
            {activeOverlays.includes('EMA12') && (
              <span className="indicator-tag" style={{ borderColor: CHART_COLORS.ema12 }}>
                <span style={{ color: CHART_COLORS.ema12 }}>●</span> EMA 12
              </span>
            )}
            {activeOverlays.includes('EMA26') && (
              <span className="indicator-tag" style={{ borderColor: CHART_COLORS.ema26 }}>
                <span style={{ color: CHART_COLORS.ema26 }}>●</span> EMA 26
              </span>
            )}
            {activeOverlays.includes('BB') && (
              <span className="indicator-tag" style={{ borderColor: CHART_COLORS.bbUpper }}>
                <span style={{ color: CHART_COLORS.bbUpper }}>●</span> Bollinger (20,2)
              </span>
            )}
            {activeOverlays.includes('VWAP') && (
              <span className="indicator-tag" style={{ borderColor: CHART_COLORS.vwap }}>
                <span style={{ color: CHART_COLORS.vwap }}>●</span> VWAP
              </span>
            )}
            {activeOverlays.includes('PIVOTS') && (
              <span className="indicator-tag">
                <span>┄</span> S1 / Pivot / R1
              </span>
            )}
          </div>
        )}
      </div>

      {activeOscillator && (
        <div className="indicator-panel" style={{ height: 155 }}>
          <div
            style={{
              position: 'absolute',
              top: 6,
              left: 12,
              zIndex: 10,
              fontSize: 11,
              fontWeight: 600,
              color: '#94a3b8',
              background: 'rgba(10, 14, 23, 0.75)',
              padding: '2px 8px',
              borderRadius: 4,
              pointerEvents: 'none',
            }}
          >
            {activeOscillator === 'RSI' && 'RSI (14) — Overbought > 70 | Oversold < 30'}
            {activeOscillator === 'MACD' && 'MACD (12, 26, 9) — Blue: MACD | Orange: Signal'}
            {activeOscillator === 'STOCH' && 'Stochastic (14, 3) — %K / %D'}
            {activeOscillator === 'ATR' && 'ATR (14) — Average True Range (Volatility)'}
          </div>
          <div ref={oscContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      )}
    </div>
  );
}

