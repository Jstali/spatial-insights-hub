import React from 'react';
import MapView from '@/components/map/MapView';

const MapPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Interactive Map</h1>
        <p className="text-muted-foreground">
          Explore GIS sites on an interactive map with filtering and detailed information.
        </p>
      </div>
      
      <MapView />
    </div>
  );
};

export default MapPage;