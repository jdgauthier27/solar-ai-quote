"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Add TypeScript declarations for Google Maps API
declare global {
  interface Window {
    google: {
      maps: {
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
          clearInstanceListeners: (instance: any) => void;
        };
      };
    };
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

  const [isGenerating, setIsGenerating] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Add ref for address input
  const addressInputRef = useRef<HTMLInputElement>(null);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    // Use the same API key that's in the script
    const apiKey = 'AIzaSyCddcFWFRf_zoV5IPv_8FhgquGPxSdmI5M';
    console.log('Google Maps API Key:', apiKey);
    
    let autocomplete: any = null;
    let isInitialized = false;
    let pollInterval: NodeJS.Timeout | null = null;
    let pollCount = 0;
    const maxPolls = 20; // Maximum 10 seconds of polling
    
    const initAutocomplete = () => {
      if (isInitialized || !addressInputRef.current) {
        console.log('Autocomplete already initialized or input ref not available');
        return;
      }
      
      console.log('Checking for Google Maps API...', {
        hasGoogle: !!window.google,
        hasMaps: !!(window.google && window.google.maps),
        hasPlaces: !!(window.google && window.google.maps && window.google.maps.places)
      });
      
      if (window.google && window.google.maps && window.google.maps.places) {
        console.log('Google Maps API is ready, initializing autocomplete...');
        
        try {
          autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
            types: ['address'],
            componentRestrictions: { country: 'us' },
          });

          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            console.log('Place selected:', place);
            
            if (place.formatted_address) {
              handleInputChange('address', place.formatted_address);
              
              // Extract coordinates if available
              if (place.geometry && place.geometry.location) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                console.log('Coordinates extracted:', lat, lng);
                
                setQuoteData(prev => ({
                  ...prev,
                  latitude: lat,
                  longitude: lng
                }));
              }
            }
          });
          
          isInitialized = true;
          console.log('Google Places Autocomplete initialized successfully!');
          
          // Clear polling interval if it exists
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        } catch (error) {
          console.error('Error initializing autocomplete:', error);
        }
      } else {
        pollCount++;
        console.log(`Google Maps API not ready yet (attempt ${pollCount}/${maxPolls}), will retry...`);
        
        if (pollCount >= maxPolls) {
          console.error('Failed to load Google Maps API after maximum attempts');
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      }
    };

    // Try to initialize immediately
    console.log('Starting autocomplete initialization...');
    initAutocomplete();
    
    // If not initialized, poll every 500ms until the API is ready
    if (!isInitialized && pollCount < maxPolls) {
      pollInterval = setInterval(() => {
        if (!isInitialized && pollCount < maxPolls) {
          initAutocomplete();
        } else {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      }, 500);
    }
    
    // Cleanup function
    return () => {
      console.log('Cleaning up autocomplete...');
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (autocomplete && window.google && window.google.maps && window.google.maps.event) {
        try {
          window.google.maps.event.clearInstanceListeners(autocomplete);
          console.log('Autocomplete listeners cleared');
        } catch (error) {
          console.log('Error cleaning up autocomplete:', error);
        }
      }
    };
  }, []);

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
      return null;
    } catch (error) {
      console.error('Building data error:', error);
      return null;
    }
  };

  // Calculate solar system based on real building data
  const calculateSolarSystem = useCallback(() => {
    const basePricePerWatt = 2.85;
    const federalIncentive = 0.30;
    const stateIncentive = 0.10;
    
    let systemSize = quoteData.systemSize;
    let panels = Math.round(systemSize * 2.5);
    let annualProduction = systemSize * 1500;
    
    // Use real building data if available
    if (quoteData.buildingData) {
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
    const annualSavings = quoteData.monthlyBill * 12 * 0.8;
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
  }, [quoteData]);

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
          setQuoteData(prev => ({
            ...prev,
            latitude: coords.latitude,
            longitude: coords.longitude
          }));
          
          // Step 2: Get building data
          const buildingData = await getBuildingData(coords.latitude, coords.longitude);
          
          if (buildingData) {
            setQuoteData(prev => ({
              ...prev,
              buildingData
            }));
          }
        }
        
        setTimeout(() => {
          setIsGenerating(false);
          setIsAnalyzing(false);
          setStep(2);
        }, 3000);
        
      } catch (error) {
        console.error('Error processing address:', error);
        setIsGenerating(false);
        setIsAnalyzing(false);
        setStep(2);
      }
    }
  };

  const handleGetQuote = () => {
    setShowQuote(true);
    setStep(3);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

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
              {step === 2 && "Step 2: Customize System"}
              {step === 3 && "Your Quote"}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Visual Progress Steps - Always visible */}
        <div className="mb-16">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">Your Solar Journey in 3 Simple Steps</h3>
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute top-8 left-0 right-0 h-1 bg-gray-200 rounded-full">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-green-600 rounded-full transition-all duration-500"
                  style={{ width: `${((step - 1) / 2) * 100}%` }}
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

                {/* Step 2: Customize */}
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
                    Customize System
                  </h4>
                  <p className="text-sm text-gray-600 leading-tight">
                    Adjust system size, panel type, and add battery storage to fit your needs
                  </p>
                  {step === 2 && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Current Step
                      </span>
                    </div>
                  )}
                </div>

                {/* Step 3: Get Quote */}
                <div className="flex flex-col items-center text-center max-w-xs">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-4 transition-all duration-300 ${
                    step >= 3 
                      ? 'bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step >= 3 ? '✓' : '3'}
                  </div>
                  <h4 className={`font-semibold mb-2 transition-colors ${
                    step >= 3 ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    Get Your Quote
                  </h4>
                  <p className="text-sm text-gray-600 leading-tight">
                    Receive detailed pricing, savings calculation, and payback period
                  </p>
                  {step === 3 && (
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
                Get the most accurate solar quote in minutes using advanced AI and Google's Solar API. 
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
                <p className="text-sm text-gray-500 mt-2">We use Google's address autocomplete for accuracy</p>
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
          <div className="grid lg:grid-cols-2 gap-12">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Customize Your Solar System</h3>
              
              {quoteData.buildingData && (
                <div className="mb-6 p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2">✅ AI Analysis Complete</h4>
                  <div className="text-sm text-green-700 space-y-1">
                    <p>• Roof area: {solarSystem.roofArea} sq ft</p>
                    <p>• Max panels possible: {quoteData.buildingData.solarPotential.maxArrayPanelsCount}</p>
                    <p>• System efficiency: {solarSystem.efficiency}%</p>
                  </div>
                </div>
              )}
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Electric Bill: ${quoteData.monthlyBill}
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="500"
                    step="25"
                    value={quoteData.monthlyBill}
                    onChange={(e) => handleInputChange('monthlyBill', parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>$50</span>
                    <span>$500</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    System Size: {solarSystem.size} kW
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="15"
                    step="0.2"
                    value={quoteData.systemSize}
                    onChange={(e) => handleInputChange('systemSize', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>3 kW</span>
                    <span>15 kW</span>
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

                <button
                  onClick={handleGetQuote}
                  className="w-full bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-lg"
                >
                  Get Full Quote
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && showQuote && (
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
                  onClick={() => setStep(2)}
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
    </div>
  );
}
