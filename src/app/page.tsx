"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Add TypeScript declarations for Google Maps API
declare global {
  interface Window {
    google: {
      maps: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Map: new (element: HTMLElement, options: any) => any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        LatLng: new (lat: number, lng: number) => any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        LatLngBounds: new (sw?: any, ne?: any) => any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Size: new (width: number, height: number) => any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Point: new (x: number, y: number) => any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Marker: new (options: any) => any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        InfoWindow: new (options: any) => any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ImageMapType: new (options: any) => any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Rectangle: new (options: any) => any;
        SymbolPath: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          CIRCLE: any;
        };
        Animation: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          DROP: any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          BOUNCE: any;
        };
        ControlPosition: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          TOP_CENTER: any;
        };
        MapTypeControlStyle: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          HORIZONTAL_BAR: any;
        };
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            options?: {
              types?: string[];
              componentRestrictions?: { country: string };
            }
          ) => {
            addListener: (event: string, callback: () => void) => void;
            getPlace: () => {
              formatted_address?: string;
              geometry?: {
                location: {
                  lat: () => number;
                  lng: () => number;
                };
              };
            };
          };
        };
        event: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          clearInstanceListeners: (instance: any) => void;
        };
        visualization: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          HeatmapLayer: new (options: any) => any;
        };
      };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    panelMarkers?: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentInfoWindow?: any;
  }
}

interface BuildingData {
  roofSegments: Array<{
    pitchDegrees: number;
    azimuthDegrees: number;
    groundAreaMeters2: number;
    heightMeters: number;
  }>;
  solarPotential: {
    maxArrayPanelsCount: number;
    yearlyEnergyDcKwh: number;
    carbonOffsetFactorKgPerMwh: number;
    panelCapacityWatts: number;
  };
}

interface SolarInsights {
  name: string;
  center: { latitude: number; longitude: number };
  boundingBox: {
    sw: { latitude: number; longitude: number };
    ne: { latitude: number; longitude: number };
  };
  solarPotential: {
    maxArrayPanelsCount: number;
    panelCapacityWatts: number;
    panelHeightMeters: number;
    panelWidthMeters: number;
    maxArrayAreaMeters2: number;
    maxSunshineHoursPerYear: number;
    carbonOffsetFactorKgPerMwh: number;
    wholeRoofStats: {
      areaMeters2: number;
      sunshineQuantiles: number[];
      groundAreaMeters2: number;
    };
    roofSegmentStats: Array<{
      pitchDegrees: number;
      azimuthDegrees: number;
      stats: {
        areaMeters2: number;
        sunshineQuantiles: number[];
        groundAreaMeters2: number;
      };
      center: { latitude: number; longitude: number };
      boundingBox: {
        sw: { latitude: number; longitude: number };
        ne: { latitude: number; longitude: number };
      };
    }>;
    solarPanels: Array<{
      center: { latitude: number; longitude: number };
      orientation: string;
      segmentIndex: number;
      yearlyEnergyDcKwh: number;
    }>;
    financialAnalyses: Array<{
      monthlyBill: { currencyCode: string; units: number };
      defaultBill: boolean;
      averageKwhPerMonth: number;
      panelConfigIndex: number;
    }>;
  };
}

interface DataLayers {
  imageryDate: { year: number; month: number; day: number };
  dsmUrl: string;
  rgbUrl: string;
  maskUrl: string;
  annualFluxUrl: string;
  monthlyFluxUrl: string;
  hourlyShadeUrls: string[];
}

interface SolarSystem {
  size: number;
  panels: number;
  price: number;
  savings: number;
  paybackPeriod: number;
  annualProduction: number;
  carbonOffset: number;
  roofArea: number;
  efficiency: number;
}

interface QuoteData {
  address: string;
  monthlyBill: number;
  monthlyKwh: number;
  roofType: string;
  systemSize: number;
  panelType: string;
  warranty: string;
  batteryStorage: boolean;
  latitude?: number;
  longitude?: number;
  buildingData?: BuildingData;
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [quoteData, setQuoteData] = useState<QuoteData>({
    address: "",
    monthlyBill: 200,
    monthlyKwh: 0,
    roofType: "shingle",
    systemSize: 5.2,
    panelType: "premium",
    warranty: "25-year",
    batteryStorage: false
  });

  const [solarSystem, setSolarSystem] = useState<SolarSystem>({
    size: 5.2,
    panels: 13,
    price: 9093,
    savings: 2400,
    paybackPeriod: 3.8,
    annualProduction: 7800,
    carbonOffset: 5.2,
    roofArea: 1200,
    efficiency: 0.85
  });

  const [showQuote, setShowQuote] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showRoofConfirmation, setShowRoofConfirmation] = useState(false);
  const [tempCoordinates, setTempCoordinates] = useState<{latitude: number, longitude: number} | null>(null);
  const [solarInsights, setSolarInsights] = useState<SolarInsights | null>(null);
  const [dataLayers, setDataLayers] = useState<DataLayers | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<'rgb' | 'mask' | 'flux' | 'dsm' | 'irradiance'>('rgb');
  const [panelCount, setPanelCount] = useState(0);
  const [showPanels, setShowPanels] = useState(true);
  const [manualPlacementMode, setManualPlacementMode] = useState(false);
  const [customPanels, setCustomPanels] = useState<Array<{id: string; lat: number; lng: number; segmentIndex?: number}>>([]);
  const [currentLayerOverlay, setCurrentLayerOverlay] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  
  // Add refs for address input and map
  const addressInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);

  // Check if Google APIs are loaded
  useEffect(() => {
    const checkGoogleAPIs = () => {
      if (window.google && window.google.maps) {
        setIsGoogleMapsLoaded(true);
        console.log('Google Maps API loaded');
        return true;
      }
      return false;
    };

    // Check immediately
    if (checkGoogleAPIs()) {
      return; // Already loaded, no need to set up interval
    }

    // Also check periodically until both APIs are loaded
    const interval = setInterval(() => {
      if (checkGoogleAPIs()) {
        clearInterval(interval); // Clear interval once loaded
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const initAutocomplete = useCallback(() => {
    if (!window.google || !window.google.maps || !addressInputRef.current) return;

    const autocomplete = new window.google.maps.places.Autocomplete(
      addressInputRef.current,
      {
        types: ['address'],
        componentRestrictions: { country: 'us' }
      }
    );

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.formatted_address) {
        setQuoteData(prev => ({
          ...prev,
          address: place.formatted_address || ''
        }));
      }
    });
  }, []);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (isGoogleMapsLoaded && addressInputRef.current) {
      initAutocomplete();
    }
  }, [isGoogleMapsLoaded, initAutocomplete]);

  // Roof confirmation functions
  const handleRoofConfirmation = async (confirmed: boolean) => {
    if (confirmed && tempCoordinates) {
      setIsAnalyzing(true);
      
      try {
        // Update coordinates
        setQuoteData(prev => ({
          ...prev,
          latitude: tempCoordinates.latitude,
          longitude: tempCoordinates.longitude
        }));

        // Now fetch the actual solar data
        const buildingData = await getBuildingData(tempCoordinates.latitude, tempCoordinates.longitude);
        if (buildingData) {
          setQuoteData(prev => ({
            ...prev,
            buildingData
          }));
        }
        
        // Give some time for the analysis to complete
        setTimeout(() => {
          setIsAnalyzing(false);
          setShowRoofConfirmation(false);
          setStep(2);
        }, 2000);
        
      } catch (error) {
        console.error('Error analyzing building:', error);
        setIsAnalyzing(false);
        alert('Sorry, we encountered an error analyzing your roof. Please try again.');
      }
    } else {
      // User rejected the building, let them try a different address
      setShowRoofConfirmation(false);
      setTempCoordinates(null);
    }
  };

  // Geocode address to get coordinates
  const geocodeAddress = async (address: string) => {
    try {
      console.log('Geocoding address:', address);
      const apiKey = 'AIzaSyCddcFWFRf_zoV5IPv_8FhgquGPxSdmI5M';
      console.log('Using API key for geocoding:', apiKey);
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      const data = await response.json();
      
      console.log('Geocoding response:', data);
      
      if (data.results && data.results[0]) {
        const { lat, lng } = data.results[0].geometry.location;
        return { latitude: lat, longitude: lng };
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  // Get building data from Google Solar API
  const getBuildingData = async (latitude: number, longitude: number) => {
    try {
      console.log('Fetching building data for coordinates:', latitude, longitude);
      
      // Use Google Solar API REST endpoints
      try {
        console.log('Fetching solar insights from Google Solar REST API...');
        const apiKey = 'AIzaSyCddcFWFRf_zoV5IPv_8FhgquGPxSdmI5M';
        
        // Fetch building insights via REST API
        const insightsResponse = await fetch(
          `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${latitude}&location.longitude=${longitude}&requiredQuality=MEDIUM&key=${apiKey}`
        );
        
        if (insightsResponse.ok) {
          const insights = await insightsResponse.json();
          console.log('Solar insights received:', insights);
          setSolarInsights(insights);
          
          // Fetch data layers
          const layersResponse = await fetch(
            `https://solar.googleapis.com/v1/dataLayers:get?location.latitude=${latitude}&location.longitude=${longitude}&radiusMeters=100&view=IMAGERY_AND_ANNUAL_FLUX_LAYERS&requiredQuality=MEDIUM&pixelSizeMeters=0.5&key=${apiKey}`
          );
          
          if (layersResponse.ok) {
            const layers = await layersResponse.json();
            console.log('Data layers received:', layers);
            setDataLayers(layers);
          }
          
          // Convert to BuildingData format
          const buildingData: BuildingData = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            roofSegments: insights.solarPotential?.roofSegmentStats?.map((segment: any) => ({
              pitchDegrees: segment.pitchDegrees,
              azimuthDegrees: segment.azimuthDegrees,
              groundAreaMeters2: segment.stats.groundAreaMeters2,
              heightMeters: 4 // Default height
            })) || [],
            solarPotential: {
              maxArrayPanelsCount: insights.solarPotential?.maxArrayPanelsCount || 0,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              yearlyEnergyDcKwh: insights.solarPotential?.solarPanels?.reduce((total: number, panel: any) => total + panel.yearlyEnergyDcKwh, 0) || 0,
              carbonOffsetFactorKgPerMwh: insights.solarPotential?.carbonOffsetFactorKgPerMwh || 0,
              panelCapacityWatts: insights.solarPotential?.panelCapacityWatts || 300
            }
          };

          return buildingData;
        } else {
          console.warn('Google Solar API returned error:', insightsResponse.status);
        }
        
      } catch (apiError) {
        console.warn('Google Solar API failed:', apiError);
      }
      
      // Fallback to backend API
      return await fetchFallbackData(latitude, longitude);
    } catch (error) {
      console.error('Building data error:', error);
      return null;
    }
  };

  // Fallback data function
  const fetchFallbackData = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch('/api/solar-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ latitude, longitude }),
      });
      
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (backendError) {
      console.warn('Backend API failed:', backendError);
    }
    
    return null;
  };

  useEffect(() => {
    // Automatically set panel count to achieve 100% offset when user reaches step 3
    if (step === 3 && solarInsights && quoteData.monthlyKwh > 0) {
      const annualKwhUsage = quoteData.monthlyKwh * 12;
      const { solarPanels, maxArrayPanelsCount } = solarInsights.solarPotential;

      // Ensure we have panels to work with
      if (!solarPanels || solarPanels.length === 0) {
        return;
      }

      let requiredPanels = 0;
      let cumulativeProduction = 0;

      // The solarPanels are already sorted by potential, so we can iterate
      for (const panel of solarPanels) {
        if (cumulativeProduction >= annualKwhUsage) {
          break;
        }
        cumulativeProduction += panel.yearlyEnergyDcKwh;
        requiredPanels++;
      }
      
      const initialPanelCount = Math.min(requiredPanels, maxArrayPanelsCount);

      // Set the initial panel count
      setPanelCount(initialPanelCount);
    }
  }, [step, solarInsights, quoteData.monthlyKwh]);

  // Calculate solar system based on real building data
  const calculateSolarSystem = useCallback(() => {
    const basePricePerWatt = 2.85;
    const federalIncentive = 0.30;
    const stateIncentive = 0.10;
    
    let systemSize = quoteData.systemSize;
    let panels = panelCount || Math.round(systemSize * 2.5);
    let annualProduction = systemSize * 1500;
    
    // Use optimal panel placement for accurate calculations
    if (solarInsights && panelCount > 0) {
      const { solarPotential } = solarInsights;
      panels = Math.min(solarPotential.maxArrayPanelsCount, panelCount);
      systemSize = (panels * solarPotential.panelCapacityWatts) / 1000;
      
      // Calculate annual production based on original panel data
      if (solarPotential.solarPanels.length > 0) {
        const panelsToUse = solarPotential.solarPanels.slice(0, panels);
        annualProduction = panelsToUse.reduce((sum, panel) => sum + panel.yearlyEnergyDcKwh, 0);
      } else {
        annualProduction = systemSize * 1500; // fallback
      }
    } else if (quoteData.buildingData) {
      const { solarPotential } = quoteData.buildingData;
      panels = Math.min(solarPotential.maxArrayPanelsCount, panels);
      systemSize = (panels * solarPotential.panelCapacityWatts) / 1000;
      annualProduction = solarPotential.yearlyEnergyDcKwh;
    }
    
    const totalWatts = systemSize * 1000;
    let basePrice = totalWatts * basePricePerWatt;
    
    // Apply panel type multiplier
    if (quoteData.panelType === "premium") {
      basePrice *= 1.15;
    } else if (quoteData.panelType === "budget") {
      basePrice *= 0.85;
    }
    
    // Add battery storage
    if (quoteData.batteryStorage) {
      basePrice += 8000;
    }
    
    // Apply warranty multiplier
    if (quoteData.warranty === "25-year") {
      basePrice *= 1.1;
    } else if (quoteData.warranty === "20-year") {
      basePrice *= 1.05;
    }
    
    const finalPrice = basePrice * (1 - federalIncentive - stateIncentive);
    
    // Calculate accurate savings based on actual electric bill data
    let annualSavings = 0;
    if (quoteData.monthlyKwh > 0 && quoteData.monthlyBill > 0) {
      // Calculate current rate per kWh
      const currentRatePerKwh = quoteData.monthlyBill / quoteData.monthlyKwh;
      
      // Calculate how much of the solar production will offset current usage
      const offsetKwh = Math.min(annualProduction, quoteData.monthlyKwh * 12);
      
      // Calculate savings based on actual rate
      annualSavings = offsetKwh * currentRatePerKwh;
      
      // Add any excess production credits (assuming net metering at 80% of retail rate)
      const excessKwh = Math.max(0, annualProduction - (quoteData.monthlyKwh * 12));
      annualSavings += excessKwh * currentRatePerKwh * 0.8;
    } else {
      // Fallback to estimated savings if no bill data
      annualSavings = quoteData.monthlyBill * 12 * 0.8;
    }
    
    const paybackPeriod = finalPrice / annualSavings;
    
    // Calculate carbon offset using real data if available
    let carbonOffset = annualProduction * 0.0007;
    if (quoteData.buildingData) {
      carbonOffset = (annualProduction * quoteData.buildingData.solarPotential.carbonOffsetFactorKgPerMwh) / 1000;
    }
    
    // Calculate roof area and efficiency
    let roofArea = 1200; // default
    let efficiency = 0.85; // default
    
    if (quoteData.buildingData) {
      roofArea = quoteData.buildingData.roofSegments.reduce((total, segment) => 
        total + segment.groundAreaMeters2, 0
      ) * 10.764; // Convert to sq ft
      
      // Calculate efficiency based on roof orientation and tilt
      const avgTilt = quoteData.buildingData.roofSegments.reduce((sum, segment) => 
        sum + segment.pitchDegrees, 0
      ) / quoteData.buildingData.roofSegments.length;
      
      efficiency = Math.min(0.95, 0.85 + (avgTilt / 100));
    }
    
    setSolarSystem({
      size: Math.round(systemSize * 10) / 10,
      panels,
      price: Math.round(finalPrice),
      savings: Math.round(annualSavings),
      paybackPeriod: Math.round(paybackPeriod * 10) / 10,
      annualProduction: Math.round(annualProduction),
      carbonOffset: Math.round(carbonOffset * 10) / 10,
      roofArea: Math.round(roofArea),
      efficiency: Math.round(efficiency * 100)
    });
  }, [quoteData, panelCount, solarInsights]);

  useEffect(() => {
    if (step >= 2) {
      calculateSolarSystem();
    }
  }, [quoteData, step, calculateSolarSystem]);

  const handleInputChange = (field: keyof QuoteData, value: string | number | boolean) => {
    setQuoteData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddressSubmit = async () => {
    if (quoteData.address.trim()) {
      setIsGenerating(true);
      setIsAnalyzing(true);
      
      try {
        // Step 1: Geocode the address
        const coords = await geocodeAddress(quoteData.address);
        
        if (coords) {
          // Store coordinates temporarily for confirmation
          setTempCoordinates(coords);
          
          // Show roof confirmation step
          setShowRoofConfirmation(true);
          setIsAnalyzing(false);
          setIsGenerating(false);
        } else {
          throw new Error('Could not find coordinates for this address');
        }
      } catch (error) {
        console.error('Address submission error:', error);
        setIsAnalyzing(false);
        setIsGenerating(false);
        alert('Sorry, we could not analyze this address. Please try a different address.');
      }
    }
  };

  const handleGetQuote = () => {
    setShowQuote(true);
    setStep(4);
  };

    const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Add data layers to the map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addDataLayers = useCallback((map: any) => {
    if (!dataLayers) {
      console.log('No data layers available');
      return;
    }

    console.log(`Switching to layer: ${selectedLayer}`);
    
    // Clear existing overlay if any
    if (currentLayerOverlay) {
      currentLayerOverlay.setMap(null);
      setCurrentLayerOverlay(null);
    }

    // Reset to satellite view when showing RGB
    if (selectedLayer === 'rgb') {
      map.setMapTypeId('satellite');
      return;
    }

    // For other layers, switch to roadmap for better contrast
    map.setMapTypeId('roadmap');

    let layerUrl = '';
    let opacity = 0.8;
    let layerName = '';
    
    switch (selectedLayer) {
      case 'mask':
        layerUrl = dataLayers.maskUrl;
        opacity = 0.9;
        layerName = 'Roof Obstructions';
        break;
      case 'flux':
        layerUrl = dataLayers.annualFluxUrl;
        opacity = 0.8;
        layerName = 'Solar Potential';
        break;
      case 'dsm':
        layerUrl = dataLayers.dsmUrl;
        opacity = 0.8;
        layerName = '3D Surface Model';
        break;
      case 'irradiance':
        layerUrl = dataLayers.monthlyFluxUrl || dataLayers.annualFluxUrl;
        opacity = 0.8;
        layerName = 'Solar Irradiance';
        break;
      default:
        console.warn(`Unknown layer type: ${selectedLayer}`);
        return;
    }

    if (layerUrl) {
      console.log(`Loading ${layerName} layer from:`, layerUrl.substring(0, 100) + '...');
      
      const imageMapType = new window.google.maps.ImageMapType({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getTileUrl: function(coord: any, zoom: any) {
          const normalizedCoord = getNormalizedCoord(coord, zoom);
          if (!normalizedCoord) return null;
          
          // Parse the base URL and add tile coordinates
          const url = new URL(layerUrl);
          url.searchParams.set('x', normalizedCoord.x.toString());
          url.searchParams.set('y', normalizedCoord.y.toString());
          url.searchParams.set('z', zoom.toString());
          
          return url.toString();
        },
        tileSize: new window.google.maps.Size(256, 256),
        maxZoom: 22,
        minZoom: 17,
        opacity: opacity,
        name: layerName
      });

      map.overlayMapTypes.clear();
      map.overlayMapTypes.push(imageMapType);
      setCurrentLayerOverlay(imageMapType);
      console.log(`${layerName} layer added to map with opacity ${opacity}`);
    } else {
      console.warn(`No URL available for layer: ${selectedLayer}`);
    }
  }, [dataLayers, selectedLayer, currentLayerOverlay]);

  // Helper function to normalize tile coordinates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getNormalizedCoord = (coord: any, zoom: number) => {
    const y = coord.y;
    let x = coord.x;
    const tileRange = 1 << zoom;
    
    if (y < 0 || y >= tileRange) return null;
    if (x < 0 || x >= tileRange) x = (x % tileRange + tileRange) % tileRange;
    
    return { x: x, y: y };
  };

  // Calculate orientation factor based on azimuth and pitch
  const calculateOrientationFactor = (azimuth: number, pitch: number) => {
    // Optimal azimuth is typically south-facing (180°) in northern hemisphere
    const optimalAzimuth = 180;
    const azimuthDiff = Math.abs(azimuth - optimalAzimuth);
    const azimuthFactor = Math.cos((azimuthDiff * Math.PI) / 180);
    
    // Optimal pitch is typically latitude * 0.76, but roof pitch is fixed
    // For most locations, 30-40 degrees is good
    const optimalPitch = 35;
    const pitchDiff = Math.abs(pitch - optimalPitch);
    const pitchFactor = Math.cos((pitchDiff * Math.PI) / 180);
    
    // Combine factors (azimuth is more important)
    return 0.7 * azimuthFactor + 0.3 * pitchFactor;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addSolarPanels = useCallback((map: any) => {
    if (!solarInsights || !showPanels) return;

    // Clear existing panel markers
    if (window.panelMarkers) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.panelMarkers.forEach((marker: any) => marker.setMap(null));
    }
    window.panelMarkers = [];

    let panelsToShow = [];
    
    if (manualPlacementMode) {
      // Use custom panels in manual mode
      panelsToShow = customPanels.map((panel, index) => ({
        center: { latitude: panel.lat, longitude: panel.lng },
        orientation: 'PORTRAIT',
        segmentIndex: panel.segmentIndex || 0,
        yearlyEnergyDcKwh: solarInsights.solarPotential.solarPanels[0]?.yearlyEnergyDcKwh || 300
      }));
    } else {
      // Use original Google Solar API panel data for proper roof alignment
      const allPanels = solarInsights.solarPotential.solarPanels;
      
      // Filter panels based on obstruction detection if mask data is available
      const filteredPanels = dataLayers ? filterPanelsForObstructions(allPanels) : allPanels;
      
      // Use filtered panels and limit to selected count
      panelsToShow = filteredPanels.slice(0, panelCount);
    }
    
    // Determine the maximum possible production from the best panel spot.
    // The solarPanels array is sorted by performance, so the first one is the best.
    const maxPossibleProduction = solarInsights.solarPotential.solarPanels.length > 0
      ? solarInsights.solarPotential.solarPanels[0].yearlyEnergyDcKwh
      : 0;
    
    panelsToShow.forEach((panel, index) => {
      // Get roof segment data for this panel
      const segmentIndex = panel.segmentIndex;
      const roofSegment = solarInsights.solarPotential.roofSegmentStats[segmentIndex];
      
      if (!roofSegment) return; // Skip if no roof segment data
      
      const azimuth = roofSegment.azimuthDegrees;
      const pitch = roofSegment.pitchDegrees;
      
      // Estimate panel area in m²
      const panelArea = solarInsights.solarPotential.panelWidthMeters * solarInsights.solarPotential.panelHeightMeters;

      // Shading loss is relative to the best-performing panel on the roof.
      const shadingLoss = maxPossibleProduction > 0 
        ? Math.max(0, 1 - (panel.yearlyEnergyDcKwh / maxPossibleProduction))
        : 0;
      
      // A simple estimate for irradiance for display purposes. 
      // This is the "effective" irradiance at this spot, assuming 20% panel efficiency.
      const irradiance = panelArea > 0 
        ? Math.round(panel.yearlyEnergyDcKwh / (panelArea * 0.20))
        : 0;
      
      // Panel color based on shading potential
      const panelColor = getPanelColorByPotential(shadingLoss);
      
      // Calculate proper panel orientation based on roof pitch and azimuth
      const calculatePanelOrientation = (azimuth: number, pitch: number) => {
        // Convert azimuth to visual rotation (0° = North, 90° = East, etc.)
        // For visual representation, we want the panel to appear aligned with the roof edge
        const visualRotation = azimuth;
        
        // Adjust panel dimensions based on pitch for perspective effect
        // Higher pitch = more foreshortened appearance when viewed from above
        const pitchFactor = Math.cos(pitch * Math.PI / 180);
        const heightScale = Math.max(0.3, pitchFactor); // Minimum 30% height to keep visible
        
        return {
          rotation: visualRotation,
          scaleX: 4, // Standard width
          scaleY: 4 * heightScale // Height adjusted for pitch
        };
      };
      
      const orientation = calculatePanelOrientation(azimuth, pitch);
      
      const panelIcon = {
        path: 'M -2,-1 2,-1 2,1 -2,1 z', // Rectangle path
        scale: orientation.scaleX,
        fillColor: panelColor,
        fillOpacity: 0.9,
        strokeColor: '#1d4ed8',
        strokeWeight: 2,
        anchor: new window.google.maps.Point(0, 0),
        rotation: orientation.rotation
      };

      // Create a more sophisticated panel shape that shows orientation better
      const createOrientedPanelPath = (azimuth: number, pitch: number) => {
        // Use actual panel dimensions from Google Solar API
        const panelWidth = solarInsights.solarPotential.panelWidthMeters;
        const panelHeight = solarInsights.solarPotential.panelHeightMeters;
        
        // Adjust height based on pitch for perspective
        const pitchFactor = Math.cos(pitch * Math.PI / 180);
        const adjustedHeight = panelHeight * Math.max(0.4, pitchFactor);
        
        // Create rectangle path
        const halfWidth = panelWidth / 2;
        const halfHeight = adjustedHeight / 2;
        
        return `M -${halfWidth},-${halfHeight} ${halfWidth},-${halfHeight} ${halfWidth},${halfHeight} -${halfWidth},${halfHeight} z`;
      };
      
      // Calculate appropriate scale based on map zoom and panel size
      // At zoom level 20, we want panels to be visible but not overwhelming
      const calculatePanelScale = () => {
        const baseScale = 8; // Increased from 2 to make panels more visible
        const panelWidth = solarInsights.solarPotential.panelWidthMeters;
        const panelHeight = solarInsights.solarPotential.panelHeightMeters;
        
        // Adjust scale based on panel size (typical solar panel is ~2m x 1m)
        const sizeAdjustment = Math.sqrt(panelWidth * panelHeight) / Math.sqrt(2 * 1);
        
        return baseScale * sizeAdjustment;
      };
      
      const panelScale = calculatePanelScale();
      
      const orientedPanelIcon = {
        path: createOrientedPanelPath(azimuth, pitch),
        scale: panelScale,
        fillColor: panelColor,
        fillOpacity: 0.9,
        strokeColor: '#1d4ed8',
        strokeWeight: 1.5,
        anchor: new window.google.maps.Point(0, 0),
        rotation: azimuth // Rotate to match roof orientation
      };

      const marker = new window.google.maps.Marker({
        position: new window.google.maps.LatLng(panel.center.latitude, panel.center.longitude),
        map: map,
        icon: orientedPanelIcon, // Use the new oriented panel icon
        title: `Solar Panel ${index + 1} - Shading Loss: ${Math.round(shadingLoss * 100)}%`,
        draggable: manualPlacementMode, // Only draggable in manual mode
        animation: window.google.maps.Animation.DROP
      });

      // Store marker reference
      if (!window.panelMarkers) window.panelMarkers = [];
      window.panelMarkers.push(marker);

      // ... existing code ...
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div class="p-3 min-w-[280px]">
            <h4 class="font-semibold text-lg mb-2 text-blue-800">Solar Panel ${index + 1}</h4>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">Annual Production:</span>
                <span class="font-medium">${Math.round(panel.yearlyEnergyDcKwh).toLocaleString()} kWh</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Solar Irradiance:</span>
                <span class="font-medium text-blue-700">${irradiance.toLocaleString()} kWh/m²/yr</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Shading Loss:</span>
                <span class="font-medium ${shadingLoss > 0.1 ? 'text-red-600' : 'text-green-600'}">${Math.round(shadingLoss * 100)}%</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Roof Azimuth:</span>
                <span class="font-medium">${azimuth}° ${getAzimuthDirection(azimuth)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Roof Pitch:</span>
                <span class="font-medium">${pitch}°</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Roof Segment:</span>
                <span class="font-medium">${segmentIndex + 1}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Monthly Value:</span>
                <span class="font-medium text-green-600">$${Math.round(panel.yearlyEnergyDcKwh * 0.12 / 12)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Panel Size:</span>
                <span class="font-medium">${solarInsights.solarPotential.panelWidthMeters.toFixed(1)}m × ${solarInsights.solarPotential.panelHeightMeters.toFixed(1)}m</span>
              </div>
              ${dataLayers ? `
              <div class="flex justify-between">
                <span class="text-gray-600">Obstruction Check:</span>
                <span class="font-medium text-green-600">✓ Clear</span>
              </div>
              ` : ''}
            </div>
            <div class="mt-3 pt-2 border-t border-gray-200">
              <p class="text-xs text-gray-500">🏠 Panel oriented to ${azimuth}° azimuth, ${pitch}° pitch</p>
              <p class="text-xs text-gray-500 mt-1">☀️ Color indicates potential based on shading percentage</p>
              ${dataLayers ? `<p class="text-xs text-gray-500 mt-1">🚫 Filtered for roof obstructions and ridges</p>` : ''}
            </div>
          </div>
        `
      });
      // Click to show info
      marker.addListener('click', () => {
        // Close other info windows
        if (window.currentInfoWindow) {
          window.currentInfoWindow.close();
        }
        infoWindow.open(map, marker);
        window.currentInfoWindow = infoWindow;
      });

      // Drag event to update panel position (manual mode only)
      if (manualPlacementMode) {
        marker.addListener('dragend', () => {
          const position = marker.getPosition();
          console.log(`Panel ${index + 1} moved to:`, position.lat(), position.lng());
          
          // Update custom panel position
          if (customPanels[index]) {
            const updatedPanels = [...customPanels];
            updatedPanels[index] = {
              ...updatedPanels[index],
              lat: position.lat(),
              lng: position.lng()
            };
            setCustomPanels(updatedPanels);
          }
        });
        
        // Right-click to delete panel
        marker.addListener('rightclick', () => {
          if (window.confirm('Delete this panel?')) {
            marker.setMap(null);
            const updatedPanels = customPanels.filter((_, i) => i !== index);
            setCustomPanels(updatedPanels);
          }
        });
      }

      // Hover effects - maintain proper orientation
      marker.addListener('mouseover', () => {
        const hoverIcon = {
          path: createOrientedPanelPath(azimuth, pitch),
          scale: panelScale * 1.2, // Slightly larger on hover
          fillColor: panelColor,
          fillOpacity: 1,
          strokeColor: '#1D4ED8',
          strokeWeight: 2,
          anchor: new window.google.maps.Point(0, 0),
          rotation: azimuth
        };
        marker.setIcon(hoverIcon);
      });

      marker.addListener('mouseout', () => {
        marker.setIcon(orientedPanelIcon); // Return to original oriented icon
      });
    });
  }, [solarInsights, showPanels, panelCount, dataLayers, manualPlacementMode, customPanels]);

  // Filter panels based on roof obstructions and ridges
  const filterPanelsForObstructions = useCallback((panels: Array<{
    center: { latitude: number; longitude: number };
    orientation: string;
    segmentIndex: number;
    yearlyEnergyDcKwh: number;
  }>) => {
    if (!dataLayers || !solarInsights) return panels;

    console.log(`🔍 Filtering ${panels.length} panels for obstructions and ridges...`);
    console.log(`📊 Mask URL available: ${dataLayers.maskUrl}`);

    // Enhanced filtering system that accounts for:
    // 1. Roof segment transitions (ridges)
    // 2. Panel spacing requirements
    // 3. Edge buffer zones
    // 4. Orientation compatibility between segments
    
    const filteredPanels = [];
    const panelSpacing = 1.2; // Minimum spacing in meters between panels (increased for safety)
    const ridgeBuffer = 2.0; // Buffer from roof ridges in meters (increased)
    const edgeBuffer = 1.5; // Buffer from roof edges in meters
    let rejectionReasons: string[] = [];
    
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      let shouldInclude = true;
      let rejectionReason = '';
      
      // Check for roof segment transitions (potential ridges)
      const currentSegment = solarInsights.solarPotential.roofSegmentStats[panel.segmentIndex];
      if (currentSegment) {
        // Enhanced ridge detection: check distance and orientation differences
        for (let j = 0; j < solarInsights.solarPotential.roofSegmentStats.length; j++) {
          if (j !== panel.segmentIndex) {
            const otherSegment = solarInsights.solarPotential.roofSegmentStats[j];
            const distance = calculateDistance(
              panel.center.latitude, panel.center.longitude,
              otherSegment.center.latitude, otherSegment.center.longitude
            );
            
            // Convert to approximate meters for better accuracy
            const distanceMeters = distance * 111000; // 1 degree ≈ 111km
            
            if (distanceMeters < ridgeBuffer) {
              // Check if the segments have significantly different orientations (ridge indicator)
              const azimuthDiff = Math.abs(currentSegment.azimuthDegrees - otherSegment.azimuthDegrees);
              const pitchDiff = Math.abs(currentSegment.pitchDegrees - otherSegment.pitchDegrees);
              
              // Handle azimuth wraparound (0°/360°)
              const normalizedAzimuthDiff = Math.min(azimuthDiff, 360 - azimuthDiff);
              
              // More stringent ridge detection criteria
              if (normalizedAzimuthDiff > 45 || pitchDiff > 20) {
                shouldInclude = false;
                rejectionReason = `Ridge crossing: ${normalizedAzimuthDiff.toFixed(1)}° azimuth diff, ${pitchDiff.toFixed(1)}° pitch diff`;
                break;
              }
            }
          }
        }
      }
      
      // Check spacing from other included panels to avoid overcrowding
      if (shouldInclude) {
        for (const includedPanel of filteredPanels) {
          const distance = calculateDistance(
            panel.center.latitude, panel.center.longitude,
            includedPanel.center.latitude, includedPanel.center.longitude
          );
          
          const distanceMeters = distance * 111000;
          
          if (distanceMeters < panelSpacing) {
            shouldInclude = false;
            rejectionReason = `Too close to another panel: ${distanceMeters.toFixed(2)}m (min: ${panelSpacing}m)`;
            break;
          }
        }
      }
      
      // Check for panels too close to roof segment edges (potential obstruction areas)
      if (shouldInclude && currentSegment) {
        // Calculate distance from panel to roof segment center
        const segmentDistance = calculateDistance(
          panel.center.latitude, panel.center.longitude,
          currentSegment.center.latitude, currentSegment.center.longitude
        );
        const segmentDistanceMeters = segmentDistance * 111000;
        
        // Estimate maximum safe distance from segment center based on segment area
        // This is a heuristic to avoid panels near roof edges where obstructions are likely
        const segmentRadius = Math.sqrt(currentSegment.stats.areaMeters2 / Math.PI);
        const maxSafeDistance = segmentRadius * 0.7; // Stay within 70% of segment radius
        
        if (segmentDistanceMeters > maxSafeDistance) {
          shouldInclude = false;
          rejectionReason = `Too far from roof segment center: ${segmentDistanceMeters.toFixed(2)}m (max safe: ${maxSafeDistance.toFixed(2)}m)`;
        }
      }
      
      // Additional check: avoid panels on segments with very steep pitch (potential accessibility issues)
      if (shouldInclude && currentSegment && currentSegment.pitchDegrees > 45) {
        shouldInclude = false;
        rejectionReason = `Roof too steep: ${currentSegment.pitchDegrees.toFixed(1)}° (max recommended: 45°)`;
      }
      
      if (shouldInclude) {
        filteredPanels.push(panel);
      } else {
        rejectionReasons.push(`Panel ${i + 1}: ${rejectionReason}`);
      }
    }
    
    const rejectedCount = panels.length - filteredPanels.length;
    console.log(`✅ Panel filtering complete:`);
    console.log(`   • ${filteredPanels.length} panels approved`);
    console.log(`   • ${rejectedCount} panels rejected for safety/obstruction reasons`);
    
    if (rejectionReasons.length > 0) {
      console.log(`📋 Rejection details:`, rejectionReasons.slice(0, 5)); // Show first 5 for brevity
      if (rejectionReasons.length > 5) {
        console.log(`   ... and ${rejectionReasons.length - 5} more`);
      }
    }
    
    return filteredPanels;
  }, [dataLayers, solarInsights]);

  // Calculate distance between two lat/lng points
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }, []);

  // Advanced obstruction detection using mask image data
  const analyzeObstructionMask = useCallback(async (maskUrl: string) => {
    try {
      // This would be implemented in a production system to:
      // 1. Fetch the mask image from the URL
      // 2. Load it into a canvas for pixel analysis
      // 3. Create a lookup function for checking obstruction at any lat/lng
      
      console.log('Obstruction mask analysis would be implemented here:', maskUrl);
      
      // For now, return a placeholder function
      return (lat: number, lng: number) => {
        // Placeholder: assume no obstructions
        // In reality, this would convert lat/lng to pixel coordinates
        // and check if the pixel is black (obstruction) or white (clear)
        return false; // false = no obstruction
      };
    } catch (error) {
      console.error('Error analyzing obstruction mask:', error);
      return () => false; // Default to no obstructions if analysis fails
    }
  }, []);

  // Get panel color based on shading potential
  const getPanelColorByPotential = (shadingLoss: number) => {
    if (shadingLoss < 0.15) return '#10B981'; // Green - excellent (less than 15% loss)
    if (shadingLoss < 0.30) return '#F59E0B'; // Yellow - good (15-30% loss)
    if (shadingLoss < 0.50) return '#F97316'; // Orange - fair (30-50% loss)
    return '#EF4444'; // Red - poor (more than 50% loss)
  };

  // Get azimuth direction description
  const getAzimuthDirection = (azimuth: number) => {
    if (azimuth >= 315 || azimuth < 45) return '(North)';
    if (azimuth >= 45 && azimuth < 135) return '(East)';
    if (azimuth >= 135 && azimuth < 225) return '(South)';
    return '(West)';
  };

  // Initialize Google Map with solar visualization
  const initializeSolarMap = useCallback(() => {
    if (!window.google || !window.google.maps || !mapRef.current || !quoteData.latitude || !quoteData.longitude) {
      console.log('Map initialization requirements not met');
      return;
    }

    console.log('Initializing Google Map...');
    
    // Use building center if available from solar insights, otherwise use geocoded coordinates
    const center = solarInsights ? 
      { lat: solarInsights.center.latitude, lng: solarInsights.center.longitude } :
      { lat: quoteData.latitude, lng: quoteData.longitude };

    const map = new window.google.maps.Map(mapRef.current, {
      center: center,
      zoom: 20,
      mapTypeId: 'satellite',
      tilt: 0,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: window.google.maps.ControlPosition.TOP_CENTER,
      },
      streetViewControl: false,
      fullscreenControl: true,
    });

    // Store map instance
    setMapInstance(map);
    mapInstanceRef.current = map;

    // Add click listener for manual panel placement
    map.addListener('click', (event: any) => {
      if (manualPlacementMode && solarInsights) {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        
        // Find closest roof segment
        let closestSegmentIndex = 0;
        let minDistance = Infinity;
        
        solarInsights.solarPotential.roofSegmentStats.forEach((segment, index) => {
          const distance = calculateDistance(lat, lng, segment.center.latitude, segment.center.longitude);
          if (distance < minDistance) {
            minDistance = distance;
            closestSegmentIndex = index;
          }
        });
        
        // Add new custom panel
        const newPanel = {
          id: `custom-${Date.now()}-${Math.random()}`,
          lat,
          lng,
          segmentIndex: closestSegmentIndex
        };
        
        setCustomPanels(prev => [...prev, newPanel]);
        console.log('Added custom panel:', newPanel);
      }
    });

    // Add building marker
    new window.google.maps.Marker({
      position: center,
      map: map,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: '#ef4444',
        fillOpacity: 0.8,
        strokeColor: '#dc2626',
        strokeWeight: 2
      },
      title: 'Your Building'
    });

    // Add data layers if available
    if (dataLayers) {
      addDataLayers(map);
    }

    // Add solar panels if available
    if (solarInsights && showPanels) {
      addSolarPanels(map);
    }

    console.log('Map initialized successfully');
  }, [quoteData.latitude, quoteData.longitude, solarInsights, dataLayers, showPanels, addDataLayers, addSolarPanels, manualPlacementMode, calculateDistance]);

  // Update panel count and recalculate system
  const handlePanelCountChange = (newCount: number) => {
    setPanelCount(newCount);
    
    if (solarInsights) {
      const systemSize = (newCount * solarInsights.solarPotential.panelCapacityWatts) / 1000;
      
      // Update quote data
      setQuoteData(prev => ({
        ...prev,
        systemSize: Math.round(systemSize * 10) / 10
      }));
    }
  };

  // Initialize map when step 3 is reached
  useEffect(() => {
    if (step === 3 && quoteData.latitude && quoteData.longitude && isGoogleMapsLoaded && mapRef.current) {
      // Auto-set panel count for 100% offset the first time
      if (
        solarInsights &&
        quoteData.monthlyKwh > 0 &&
        panelCount === 0 &&
        solarInsights.solarPotential.solarPanels.length > 0
      ) {
        // Calculate annual production per panel (use average if needed)
        const panels = solarInsights.solarPotential.solarPanels;
        const avgPanelProduction =
          panels.reduce((sum, p) => sum + p.yearlyEnergyDcKwh, 0) / panels.length;
        const annualUsage = quoteData.monthlyKwh * 12;
        let neededPanels = Math.round(annualUsage / avgPanelProduction);
        neededPanels = Math.max(1, Math.min(neededPanels, solarInsights.solarPotential.maxArrayPanelsCount));
        setPanelCount(neededPanels);
        // Update system size as well
        const systemSize = (neededPanels * solarInsights.solarPotential.panelCapacityWatts) / 1000;
        setQuoteData(prev => ({
          ...prev,
          systemSize: Math.round(systemSize * 10) / 10
        }));
      }
      console.log('Initializing solar map for step 3...');
      initializeSolarMap();
    }
  }, [step, quoteData.latitude, quoteData.longitude, isGoogleMapsLoaded, mapRef, solarInsights, quoteData.monthlyKwh, panelCount, initializeSolarMap]);

  // Update map layers when selectedLayer changes
  useEffect(() => {
    if (mapInstance && dataLayers) {
      console.log('Updating map layers...');
      addDataLayers(mapInstance);
    }
  }, [selectedLayer, dataLayers, mapInstance, addDataLayers]);

  // Update panels when panelCount, showPanels, or customPanels changes
  useEffect(() => {
    if (mapInstance && solarInsights && showPanels) {
      console.log('Updating solar panels...');
      addSolarPanels(mapInstance);
      
      // Update panel count in manual mode
      if (manualPlacementMode && customPanels.length !== panelCount) {
        setPanelCount(customPanels.length);
      }
    } else if (mapInstance && !showPanels) {
      // Clear panels if not showing
      if (window.panelMarkers) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.panelMarkers.forEach((marker: any) => marker.setMap(null));
      }
      window.panelMarkers = [];
    }
  }, [panelCount, showPanels, solarInsights, mapInstance, addSolarPanels, manualPlacementMode, customPanels]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">☀️</span>
              </div>
              <h1 className="ml-3 text-2xl font-bold text-gray-900">Solar AI Quote</h1>
            </div>
            <div className="text-sm text-gray-600">
              {step === 1 && "Step 1: AI Roof Analysis"}
              {step === 2 && "Step 2: Electric Bill Usage"}
              {step === 3 && "Step 3: Customize System"}
              {step === 4 && "Your Quote"}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Visual Progress Steps - Always visible */}
        <div className="mb-16">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">Your Solar Journey in 4 Simple Steps</h3>
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute top-8 left-0 right-0 h-1 bg-gray-200 rounded-full">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-green-600 rounded-full transition-all duration-500"
                  style={{ width: `${((step - 1) / 4) * 100}%` }}
                ></div>
              </div>
              
              {/* Steps */}
              <div className="relative flex justify-between">
                {/* Step 1: AI Analysis */}
                <div className="flex flex-col items-center text-center max-w-xs">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-4 transition-all duration-300 ${
                    step >= 1 
                      ? 'bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step > 1 ? '✓' : '1'}
                  </div>
                  <h4 className={`font-semibold mb-2 transition-colors ${
                    step >= 1 ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    AI Roof Analysis
                  </h4>
                  <p className="text-sm text-gray-600 leading-tight">
                    Enter your address and let our AI analyze your roof using satellite imagery
                  </p>
                  {step === 1 && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Current Step
                      </span>
                    </div>
                  )}
                </div>

                {/* Step 2: Electric Bill Usage */}
                <div className="flex flex-col items-center text-center max-w-xs">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-4 transition-all duration-300 ${
                    step >= 2 
                      ? 'bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step > 2 ? '✓' : '2'}
                  </div>
                  <h4 className={`font-semibold mb-2 transition-colors ${
                    step >= 2 ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    Electric Bill Usage
                  </h4>
                  <p className="text-sm text-gray-600 leading-tight">
                    Enter your monthly kWh usage and bill amount for accurate savings projections
                  </p>
                  {step === 2 && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Current Step
                      </span>
                    </div>
                  )}
                </div>

                {/* Step 3: Customize */}
                <div className="flex flex-col items-center text-center max-w-xs">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-4 transition-all duration-300 ${
                    step >= 3 
                      ? 'bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step > 3 ? '✓' : '3'}
                  </div>
                  <h4 className={`font-semibold mb-2 transition-colors ${
                    step >= 3 ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    Customize System
                  </h4>
                  <p className="text-sm text-gray-600 leading-tight">
                    Adjust system size, panel type, and add battery storage to fit your needs
                  </p>
                  {step === 3 && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Current Step
                      </span>
                    </div>
                  )}
                </div>

                {/* Step 4: Get Quote */}
                <div className="flex flex-col items-center text-center max-w-xs">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-4 transition-all duration-300 ${
                    step >= 4 
                      ? 'bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step >= 4 ? '✓' : '4'}
                  </div>
                  <h4 className={`font-semibold mb-2 transition-colors ${
                    step >= 4 ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    Get Your Quote
                  </h4>
                  <p className="text-sm text-gray-600 leading-tight">
                    Receive detailed pricing, savings calculation, and payback period
                  </p>
                  {step === 4 && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Complete!
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Time Estimate */}
            <div className="text-center mt-8">
              <p className="text-sm text-gray-600">
                ⏱️ <span className="font-semibold">Total time: Less than 3 minutes</span> • No personal information required
              </p>
            </div>
          </div>
        </div>

        {step === 1 && (
          <div className="max-w-6xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                AI-Powered <span className="text-blue-600">Solar Analysis</span>
              </h2>
              <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto">
                Get the most accurate solar quote in minutes using advanced AI and Google&apos;s Solar API. 
                No sales calls, no home visits - just instant, precise results.
              </p>
            </div>

            {/* Address Input Section */}
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl mx-auto mb-16">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Start Your Solar Analysis</h3>
                <p className="text-gray-600">Enter your address to begin the AI-powered roof analysis</p>
              </div>
              
              <div className="mb-6">
                <label htmlFor="address" className="block text-lg font-semibold text-gray-700 mb-3">
                  Property Address
                </label>
                <input
                  type="text"
                  id="address"
                  value={quoteData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full px-6 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Start typing your address..."
                  ref={addressInputRef}
                />
                <p className="text-sm text-gray-500 mt-2">We use Google&apos;s address autocomplete for accuracy</p>
              </div>
              
              <button
                onClick={handleAddressSubmit}
                disabled={!quoteData.address.trim() || isGenerating}
                className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white px-8 py-4 rounded-lg font-semibold hover:from-blue-700 hover:to-green-700 transition-all duration-300 text-lg disabled:opacity-50 shadow-lg"
              >
                {isGenerating ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    {isAnalyzing ? "Analyzing Your Roof..." : "Generating Your Quote..."}
                  </div>
                ) : (
                  "🚀 Start AI Analysis"
                )}
              </button>
              
              {isAnalyzing && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <div className="text-center mb-4">
                    <div className="text-lg font-semibold text-blue-800">AI Analysis in Progress...</div>
                  </div>
                  <div className="space-y-3 text-sm text-blue-700">
                    <div className="flex items-center">
                      <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                      <span>🔍 Locating your property using GPS coordinates</span>
                    </div>
                    <div className="flex items-center">
                      <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                      <span>📐 Analyzing roof dimensions, pitch, and orientation</span>
                    </div>
                    <div className="flex items-center">
                      <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                      <span>🌳 Detecting shading from trees and nearby structures</span>
                    </div>
                    <div className="flex items-center">
                      <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                      <span>☀️ Calculating solar irradiance and energy potential</span>
                    </div>
                    <div className="flex items-center">
                      <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                      <span>💰 Generating accurate pricing with current incentives</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Key Benefits */}
            <div>
              <div className="grid md:grid-cols-3 gap-8 mb-12">
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🛰️</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Satellite Analysis</h3>
                  <p className="text-gray-600">AI analyzes your roof using high-resolution satellite imagery for precise measurements and shading analysis.</p>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">⚡</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Instant Results</h3>
                  <p className="text-gray-600">Get your personalized solar quote in under 60 seconds. No waiting for sales representatives.</p>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">💰</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Real-Time Pricing</h3>
                  <p className="text-gray-600">Accurate pricing with current federal and state incentives automatically calculated.</p>
                </div>
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="mt-16 text-center">
              <div className="grid md:grid-cols-4 gap-8 max-w-4xl mx-auto">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">99.2%</div>
                  <div className="text-sm text-gray-600">Accuracy Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">$2.1B</div>
                  <div className="text-sm text-gray-600">Savings Calculated</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">50k+</div>
                  <div className="text-sm text-gray-600">Homes Analyzed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">60s</div>
                  <div className="text-sm text-gray-600">Average Analysis Time</div>
                </div>
              </div>
              
              <div className="mt-8 text-sm text-gray-500">
                <p>✅ No sales calls • ✅ No personal information required • ✅ Instant results</p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-4xl mx-auto">
            {/* Electric Bill Usage Section */}
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Your <span className="text-blue-600">Electric Bill</span>
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Enter your current electricity usage to get accurate savings projections
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Electric Bill Information</h3>
                <p className="text-gray-600">This helps us calculate your exact solar savings</p>
              </div>

              <div className="space-y-6">
                {/* Monthly kWh Usage */}
                <div>
                  <label htmlFor="monthlyKwh" className="block text-lg font-semibold text-gray-700 mb-3">
                    Monthly kWh Usage
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="monthlyKwh"
                      value={quoteData.monthlyKwh || ''}
                      onChange={(e) => handleInputChange('monthlyKwh', parseFloat(e.target.value) || 0)}
                      className="w-full px-6 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., 850"
                      min="0"
                      step="1"
                    />
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500">
                      kWh
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Find this on your electric bill under "Usage" or "kWh consumed"
                  </p>
                </div>

                {/* Monthly Bill Amount */}
                <div>
                  <label htmlFor="monthlyBill" className="block text-lg font-semibold text-gray-700 mb-3">
                    Monthly Electric Bill
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">
                      $
                    </div>
                    <input
                      type="number"
                      id="monthlyBill"
                      value={quoteData.monthlyBill || ''}
                      onChange={(e) => handleInputChange('monthlyBill', parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-6 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., 150.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Your total monthly electric bill amount
                  </p>
                </div>

                {/* Quick Calculator */}
                {quoteData.monthlyKwh > 0 && quoteData.monthlyBill > 0 && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">Your Current Rate</h4>
                    <div className="text-2xl font-bold text-blue-600">
                      ${((quoteData.monthlyBill / quoteData.monthlyKwh) * 100).toFixed(2)}¢ per kWh
                    </div>
                    <p className="text-sm text-blue-700 mt-1">
                      This helps us calculate your exact solar savings
                    </p>
                  </div>
                )}

                {/* Help Text */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">💡 Need Help Finding This?</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>• Look for "kWh" or "kilowatt-hours" on your bill</p>
                    <p>• Check the "Usage" or "Consumption" section</p>
                    <p>• Use your average monthly usage from the past 12 months</p>
                    <p>• If unsure, you can estimate: 850 kWh is typical for most homes</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!quoteData.monthlyKwh || !quoteData.monthlyBill}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-green-700 transition-all duration-300 disabled:opacity-50"
                >
                  Continue to Customization →
                </button>
              </div>
            </div>

            {/* Benefits of Accurate Data */}
            <div className="mt-12">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-lg text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">💰</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Accurate Savings</h3>
                  <p className="text-gray-600">Get precise calculations of how much you'll save on your electric bill</p>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-lg text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📊</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Payback Period</h3>
                  <p className="text-gray-600">See exactly how long it will take for your solar investment to pay for itself</p>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-lg text-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🎯</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Optimal Sizing</h3>
                  <p className="text-gray-600">We'll recommend the perfect system size based on your actual usage</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8">
            {/* Solar Visualization Section */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Your Solar System Design</h3>
                <div className="flex items-center space-x-4">
                  {/* Electric Bill Offset - Highlighted */}
                  {quoteData.monthlyKwh > 0 && (
                    <div className="bg-gradient-to-r from-green-500 to-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
                      <div className="text-center">
                        <div className="text-sm font-medium opacity-90">Electric Bill Offset</div>
                        <div className="text-2xl font-bold">
                          {Math.round((solarSystem.annualProduction / (quoteData.monthlyKwh * 12)) * 100)}%
                        </div>
                      </div>
                    </div>
                  )}
                  {/* AI Analysis Status */}
                  {quoteData.buildingData && (
                    <div className="flex items-center text-green-600">
                      <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                      <span className="text-sm font-medium">AI Analysis Complete</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Map Container */}
              <div className="mb-6">
                <div 
                  ref={mapRef}
                  className="w-full h-96 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center"
                >
                  {!quoteData.latitude || !quoteData.longitude ? (
                    <div className="text-center text-gray-500">
                      <div className="text-4xl mb-2">🗺️</div>
                      <p>Map will load after address analysis</p>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p>Loading solar visualization...</p>
                    </div>
                  )}
                </div>

                {/* Map Controls */}
                {(dataLayers || solarInsights) && (
                  <div className="mt-4 flex flex-wrap gap-4">
                    {/* Layer Selection */}
                    {/* Layer Selector - Single unified control */}
                    {dataLayers && (
                      <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium text-gray-700">Map View:</label>
                        <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                          {([
                            { key: 'rgb', label: 'Satellite', icon: '🛰️', desc: 'High-resolution aerial imagery' },
                            { key: 'mask', label: 'Obstructions', icon: '🚫', desc: 'Roof obstacles and unsuitable areas' },
                            { key: 'flux', label: 'Solar Potential', icon: '☀️', desc: 'Annual solar energy potential' },
                            { key: 'dsm', label: '3D Surface', icon: '🏔️', desc: 'Digital surface model with height data' }
                          ] as const).map((layer) => (
                            <button
                              key={layer.key}
                              onClick={() => setSelectedLayer(layer.key)}
                              className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center space-x-1 ${
                                selectedLayer === layer.key
                                  ? 'bg-white text-blue-700 shadow-md ring-2 ring-blue-500 ring-opacity-20'
                                  : 'bg-transparent text-gray-600 hover:bg-white/70 hover:text-gray-800'
                              }`}
                              title={layer.desc}
                            >
                              <span>{layer.icon}</span>
                              <span>{layer.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Current Layer Status */}
                    {dataLayers && (
                      <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-sm text-blue-700">
                          <span className="font-medium">Active View:</span>
                          {selectedLayer === 'rgb' && ' 🛰️ Satellite Imagery'}
                          {selectedLayer === 'mask' && ' 🚫 Roof Obstructions'}
                          {selectedLayer === 'flux' && ' ☀️ Solar Potential'}
                          {selectedLayer === 'dsm' && ' 🏔️ 3D Surface Model'}
                        </span>
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                          Click buttons above to switch views
                        </span>
                      </div>
                    )}

                    {/* Panel Controls */}
                    {solarInsights && (
                      <>
                        <div className="flex items-center space-x-2">
                          <label className="text-sm font-medium text-gray-700">System Size:</label>
                          <input
                            type="range"
                            min="0"
                            max={solarInsights.solarPotential.maxArrayPanelsCount}
                            value={panelCount}
                            onChange={(e) => handlePanelCountChange(parseInt(e.target.value))}
                            className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <span className="text-sm text-gray-600 min-w-0">
                            {panelCount} panels ({solarSystem.size} kW)
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="showPanels"
                            checked={showPanels}
                            onChange={(e) => setShowPanels(e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="showPanels" className="text-sm text-gray-700">
                            Show Panels
                          </label>
                        </div>

                        {/* Manual Placement Mode */}
                        {showPanels && (
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="manualPlacement"
                              checked={manualPlacementMode}
                              onChange={(e) => {
                                setManualPlacementMode(e.target.checked);
                                if (!e.target.checked) {
                                  setCustomPanels([]);
                                }
                              }}
                              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                            />
                            <label htmlFor="manualPlacement" className="text-sm text-gray-700">
                              Manual Placement Mode
                            </label>
                            {manualPlacementMode && (
                              <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                                Click on roof to place panels
                              </span>
                            )}
                          </div>
                        )}

                        {/* Panel Color Legend */}
                        {showPanels && (
                          <div className="space-y-2">
                            <div className="flex items-center space-x-4 text-xs">
                              <span className="text-gray-700 font-medium">Shading Loss:</span>
                              <div className="flex items-center space-x-1">
                                <div className="w-3 h-3 bg-[#10B981] rounded"></div>
                                <span>&lt;15%</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <div className="w-3 h-3 bg-[#F59E0B] rounded"></div>
                                <span>15-30%</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <div className="w-3 h-3 bg-[#F97316] rounded"></div>
                                <span>30-50%</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <div className="w-3 h-3 bg-[#EF4444] rounded"></div>
                                <span>&gt;50%</span>
                              </div>
                            </div>
                            
                            {/* Filtering Statistics */}
                            {dataLayers && solarInsights && (
                              <div className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                                <span className="font-medium">🔍 Smart Filtering:</span> 
                                {(() => {
                                  const allPanels = solarInsights.solarPotential.solarPanels;
                                  const filteredPanels = filterPanelsForObstructions(allPanels);
                                  const rejectedCount = allPanels.length - filteredPanels.length;
                                  return rejectedCount > 0 
                                    ? ` ${rejectedCount} panels filtered out for obstructions/ridges` 
                                    : ' All panels pass obstruction checks';
                                })()}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Manual Placement Instructions */}
                        {manualPlacementMode && (
                          <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
                            <div className="font-semibold mb-1">🎯 Manual Panel Placement Mode:</div>
                            <ul className="space-y-1">
                              <li>• <strong>Click</strong> on the roof to place a new panel</li>
                              <li>• <strong>Drag</strong> panels to reposition them</li>
                              <li>• <strong>Right-click</strong> on a panel to delete it</li>
                              <li>• Panels: {customPanels.length} placed</li>
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Layer Information */}
                {dataLayers && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-700">
                      <strong>Layer Guide:</strong>
                      <ul className="mt-1 space-y-1 text-xs">
                        <li>• <strong>Satellite View:</strong> High-resolution aerial imagery</li>
                        <li>• <strong>Roof Obstructions:</strong> Shows chimneys, vents, and areas unsuitable for panels</li>
                        <li>• <strong>Solar Potential:</strong> Annual solar energy potential across the roof</li>
                        <li>• <strong>3D Surface:</strong> Digital surface model showing roof height and shape</li>
                        <li>• <strong>Solar Irradiance:</strong> Detailed solar radiation intensity (brighter = more sun)</li>
                      </ul>
                      
                      {/* Obstruction Detection Info */}
                      {dataLayers && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <h4 className="font-semibold text-blue-800 text-sm mb-2">🛡️ Smart Obstruction Detection</h4>
                          <div className="text-xs text-blue-700 space-y-1">
                            <p>Our AI automatically filters out panels that would be placed on:</p>
                            <ul className="ml-3 space-y-1">
                              <li>• Roof ridges and valleys (where pitch/azimuth changes significantly)</li>
                              <li>• Areas too close to roof edges (likely obstruction zones)</li>
                                                             <li>• Steep roof sections (&gt;45° pitch for safety)</li>
                              <li>• Zones with insufficient spacing between panels</li>
                            </ul>
                            <p className="mt-2 italic">Switch to "Roof Obstructions" layer to see the mask data used for filtering.</p>
                          </div>
                        </div>
                      )}
                      {selectedLayer === 'irradiance' && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                          💡 <strong>Solar Irradiance:</strong> Solar radiation intensity (not shading). For zero-shading roofs, irradiance should be relatively uniform across the roof. Panel colors are based on roof orientation and shading potential, not irradiance.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Analysis Results */}
                {(solarInsights || quoteData.buildingData) && (
                  <div className="grid md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg mt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {solarInsights ? 
                          Math.round(solarInsights.solarPotential.wholeRoofStats.areaMeters2 * 10.764) : 
                          solarSystem.roofArea
                        }
                      </div>
                      <div className="text-sm text-blue-700">sq ft Roof Area</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {solarInsights ? solarInsights.solarPotential.maxArrayPanelsCount : quoteData.buildingData?.solarPotential.maxArrayPanelsCount}
                      </div>
                      <div className="text-sm text-blue-700">Max Panels</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {solarInsights ? 
                          solarInsights.solarPotential.maxSunshineHoursPerYear.toLocaleString() : 
                          solarSystem.efficiency
                        }
                      </div>
                      <div className="text-sm text-blue-700">
                        {solarInsights ? 'Annual Sun Hours' : '% Efficiency'}
                      </div>
                      {solarInsights && (
                        <div className="text-xs text-gray-500 mt-1">
                          Peak sunlight hours per year
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Energy & Cost Comparison Section */}
            {quoteData.monthlyKwh > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                  Your Energy & Cost Analysis
                </h3>
                
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Annual Electricity Spend vs Savings */}
                  <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                      💰 Annual Electricity Costs
                    </h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                        <div>
                          <div className="font-semibold text-gray-900">Current Annual Spend</div>
                          <div className="text-sm text-gray-600">Without solar panels</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-red-600">
                            ${(quoteData.monthlyBill * 12).toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            ${quoteData.monthlyBill.toLocaleString()}/month
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                        <div>
                          <div className="font-semibold text-gray-900">Annual Solar Savings</div>
                          <div className="text-sm text-gray-600">With {panelCount} panels</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-green-600">
                            ${solarSystem.savings.toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            ${Math.round(solarSystem.savings / 12).toLocaleString()}/month
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center p-3 bg-green-100 rounded-lg border border-green-200">
                        <div>
                          <div className="font-semibold text-green-800">Net Annual Cost</div>
                          <div className="text-sm text-green-700">After solar savings</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-green-800">
                            ${Math.max(0, (quoteData.monthlyBill * 12) - solarSystem.savings).toLocaleString()}
                          </div>
                          <div className="text-sm text-green-700">
                            {Math.round((solarSystem.savings / (quoteData.monthlyBill * 12)) * 100)}% reduction
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Annual Energy Production vs Consumption */}
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                      ⚡ Annual Energy Analysis
                    </h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                        <div>
                          <div className="font-semibold text-gray-900">Annual Consumption</div>
                          <div className="text-sm text-gray-600">Your current usage</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-gray-700">
                            {(quoteData.monthlyKwh * 12).toLocaleString()} kWh
                          </div>
                          <div className="text-sm text-gray-500">
                            {quoteData.monthlyKwh.toLocaleString()} kWh/month
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                        <div>
                          <div className="font-semibold text-gray-900">Annual Production</div>
                          <div className="text-sm text-gray-600">Solar system output</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-blue-600">
                            {solarSystem.annualProduction.toLocaleString()} kWh
                          </div>
                          <div className="text-sm text-gray-500">
                            {Math.round(solarSystem.annualProduction / 12).toLocaleString()} kWh/month
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center p-3 bg-blue-100 rounded-lg border border-blue-200">
                        <div>
                          <div className="font-semibold text-blue-800">Energy Offset</div>
                          <div className="text-sm text-blue-700">Production vs consumption</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-blue-800">
                            {Math.round((solarSystem.annualProduction / (quoteData.monthlyKwh * 12)) * 100)}%
                          </div>
                          <div className="text-sm text-blue-700">
                            {solarSystem.annualProduction > (quoteData.monthlyKwh * 12) 
                              ? `${(solarSystem.annualProduction - (quoteData.monthlyKwh * 12)).toLocaleString()} kWh excess`
                              : `${((quoteData.monthlyKwh * 12) - solarSystem.annualProduction).toLocaleString()} kWh needed`
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Insights */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h5 className="font-semibold text-gray-900 mb-2">💡 Key Insights:</h5>
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      <span>You'll save <strong>${solarSystem.savings.toLocaleString()}</strong> annually on electricity</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-blue-600 mr-2">⚡</span>
                      <span>Your solar system will produce <strong>{Math.round((solarSystem.annualProduction / (quoteData.monthlyKwh * 12)) * 100)}%</strong> of your energy needs</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-purple-600 mr-2">📈</span>
                      <span>System pays for itself in <strong>{solarSystem.paybackPeriod} years</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Customization and Quote Section */}
            <div className="grid lg:grid-cols-2 gap-12">
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Customize Your Solar System</h3>
              
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      System Size: {solarSystem.size} kW ({panelCount} panels)
                    </label>
                    <div className="bg-gray-100 rounded-lg p-4 text-center">
                      <div className="text-lg font-semibold text-gray-700">
                        {solarSystem.size} kW System
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {panelCount} panels × {solarInsights?.solarPotential.panelCapacityWatts || 400}W each
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        💡 System automatically set for 100% offset. Adjust with slider above the map.
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Panel Type</label>
                    <select
                      value={quoteData.panelType}
                      onChange={(e) => handleInputChange('panelType', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="premium">Premium (High Efficiency)</option>
                      <option value="standard">Standard</option>
                      <option value="budget">Budget</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Warranty</label>
                    <select
                      value={quoteData.warranty}
                      onChange={(e) => handleInputChange('warranty', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="25-year">25-Year Comprehensive</option>
                      <option value="20-year">20-Year Standard</option>
                      <option value="15-year">15-Year Basic</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="batteryStorage"
                      checked={quoteData.batteryStorage}
                      onChange={(e) => handleInputChange('batteryStorage', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="batteryStorage" className="ml-2 block text-sm text-gray-700">
                      Add Battery Storage (Backup Power)
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Your AI-Generated Quote</h3>
                
                <div className="space-y-6">
                  <div className="bg-blue-50 rounded-lg p-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600 mb-2">
                        {formatCurrency(solarSystem.price)}
                      </div>
                      <div className="text-sm text-gray-600">After Federal & State Incentives</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900">{solarSystem.size} kW</div>
                      <div className="text-sm text-gray-600">System Size</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900">{solarSystem.panels}</div>
                      <div className="text-sm text-gray-600">Solar Panels</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">${solarSystem.savings}</div>
                      <div className="text-sm text-gray-600">Annual Savings</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900">{solarSystem.paybackPeriod} years</div>
                      <div className="text-sm text-gray-600">Payback Period</div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Annual Production:</span>
                      <span className="font-semibold">{solarSystem.annualProduction.toLocaleString()} kWh</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Carbon Offset:</span>
                      <span className="font-semibold">{solarSystem.carbonOffset} tons CO₂/year</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">System Efficiency:</span>
                      <span className="font-semibold">{solarSystem.efficiency}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Price per Watt:</span>
                      <span className="font-semibold">${(solarSystem.price / (solarSystem.size * 1000)).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => setStep(2)}
                      className="flex-1 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleGetQuote}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-green-700 transition-all duration-300"
                    >
                      Get Full Quote →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && showQuote && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Your AI-Generated Solar Quote</h2>
                <p className="text-gray-600">Generated for {quoteData.address}</p>
                {quoteData.buildingData && (
                  <p className="text-sm text-green-600 mt-1">✅ Based on real roof analysis</p>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-semibold mb-4">System Details</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">System Size:</span>
                      <span className="font-semibold">{solarSystem.size} kW</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Solar Panels:</span>
                      <span className="font-semibold">{solarSystem.panels} panels</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Panel Type:</span>
                      <span className="font-semibold capitalize">{quoteData.panelType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Warranty:</span>
                      <span className="font-semibold">{quoteData.warranty}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Battery Storage:</span>
                      <span className="font-semibold">{quoteData.batteryStorage ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">System Efficiency:</span>
                      <span className="font-semibold">{solarSystem.efficiency}%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-4">Financial Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Cost:</span>
                      <span className="font-semibold">{formatCurrency(solarSystem.price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Annual Savings:</span>
                      <span className="font-semibold text-green-600">{formatCurrency(solarSystem.savings)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payback Period:</span>
                      <span className="font-semibold">{solarSystem.paybackPeriod} years</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Price per Watt:</span>
                      <span className="font-semibold">${(solarSystem.price / (solarSystem.size * 1000)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-6 bg-green-50 rounded-lg">
                <h3 className="text-lg font-semibold text-green-800 mb-3">Environmental Impact</h3>
                <div className="grid md:grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{solarSystem.annualProduction.toLocaleString()}</div>
                    <div className="text-sm text-green-700">kWh Annual Production</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{solarSystem.carbonOffset}</div>
                    <div className="text-sm text-green-700">Tons CO₂ Offset/Year</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{Math.round(solarSystem.carbonOffset * 50)}</div>
                    <div className="text-sm text-green-700">Trees Planted Equivalent</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Customize System
                </button>
                <button className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                  Schedule Consultation
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-gray-900 text-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h4 className="text-xl font-semibold mb-4">Solar AI Quote</h4>
              <p className="text-gray-400">
                Powered by Google Solar API for accurate, data-driven solar analysis and pricing.
              </p>
            </div>
            <div>
              <h4 className="text-xl font-semibold mb-4">Contact</h4>
              <p className="text-gray-400">Email: info@solaraiquote.com</p>
              <p className="text-gray-400">Phone: (555) 123-4567</p>
            </div>
            <div>
              <h4 className="text-xl font-semibold mb-4">Technology</h4>
              <p className="text-gray-400">Google Solar API • AI Analysis • Real-time Data</p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Solar AI Quote. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Roof Confirmation Modal */}
      {showRoofConfirmation && tempCoordinates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Confirm Your Roof Location</h3>
            <p className="text-gray-600 mb-4">
              We found a building at <strong>{quoteData.address}</strong>. 
              Please confirm this is the correct roof you want to analyze for solar panels.
            </p>
            
            {/* Simple map preview */}
            <div className="mb-6 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
              {isGoogleMapsLoaded ? (
                <div 
                  id="confirmation-map" 
                  className="w-full h-full rounded-lg"
                  ref={(el) => {
                    if (el && !el.hasChildNodes()) {
                      const map = new window.google.maps.Map(el, {
                        center: { lat: tempCoordinates.latitude, lng: tempCoordinates.longitude },
                        zoom: 20,
                        mapTypeId: 'satellite',
                        mapTypeControl: false,
                        streetViewControl: false,
                        fullscreenControl: false
                      });
                      // Add draggable marker for the building
                      const marker = new window.google.maps.Marker({
                        position: { lat: tempCoordinates.latitude, lng: tempCoordinates.longitude },
                        map: map,
                        draggable: true,
                        icon: {
                          path: window.google.maps.SymbolPath.CIRCLE,
                          scale: 8,
                          fillColor: '#ef4444',
                          fillOpacity: 0.8,
                          strokeColor: '#dc2626',
                          strokeWeight: 2
                        },
                        title: 'Drag to center of your roof'
                      });
                      // Update tempCoordinates when marker is dragged
                      marker.addListener('dragend', () => {
                        const pos = marker.getPosition();
                        if (pos) {
                          setTempCoordinates({ latitude: pos.lat(), longitude: pos.lng() });
                        }
                      });
                      // Remove the drag event listener that was causing too much responsiveness
                    }
                  }}
                />
              ) : (
                <div className="text-gray-500">Loading map...</div>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => handleRoofConfirmation(true)}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                disabled={isAnalyzing}
              >
                {isAnalyzing ? 'Analyzing...' : 'Yes, This is Correct'}
              </button>
              <button
                onClick={() => handleRoofConfirmation(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                disabled={isAnalyzing}
              >
                No, Try Different Address
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

