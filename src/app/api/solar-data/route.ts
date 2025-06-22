import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { latitude, longitude } = await request.json();

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
        { status: 400 }
      );
    }

    // For demo purposes, we'll simulate Google Solar API response
    // In production, you would make actual calls to Google Solar API
    const mockBuildingData = {
      roofSegments: [
        {
          pitchDegrees: 25,
          azimuthDegrees: 180,
          groundAreaMeters2: 80,
          heightMeters: 3
        },
        {
          pitchDegrees: 25,
          azimuthDegrees: 0,
          groundAreaMeters2: 80,
          heightMeters: 3
        }
      ],
      solarPotential: {
        maxArrayPanelsCount: 20,
        yearlyEnergyDcKwh: 8500,
        carbonOffsetFactorKgPerMwh: 0.7,
        panelCapacityWatts: 400
      }
    };

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return NextResponse.json(mockBuildingData);

  } catch (error) {
    console.error('Solar data API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch solar data' },
      { status: 500 }
    );
  }
} 