import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

// Fix for default markers in React Leaflet
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface GISSite {
  id: string;
  site_name: string;
  latitude: number;
  longitude: number;
  risk_status: string | null;
  site_type: string | null;
  authority: string | null;
  summer_capacity: number | null;
  winter_capacity: number | null;
  created_at: string;
}

const MapView: React.FC = () => {
  const [sites, setSites] = useState<GISSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    riskStatus: '',
    siteType: '',
    authority: '',
  });

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('gis_sites')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSites(data || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
      toast.error('Failed to load map data');
    } finally {
      setLoading(false);
    }
  };

  const filteredSites = sites.filter(site => {
    if (filters.riskStatus && site.risk_status !== filters.riskStatus) return false;
    if (filters.siteType && site.site_type !== filters.siteType) return false;
    if (filters.authority && site.authority !== filters.authority) return false;
    return true;
  });

  // Calculate map center based on sites
  const calculateCenter = (): [number, number] => {
    if (filteredSites.length === 0) return [51.505, -0.09]; // Default to London
    
    const avgLat = filteredSites.reduce((sum, site) => sum + site.latitude, 0) / filteredSites.length;
    const avgLng = filteredSites.reduce((sum, site) => sum + site.longitude, 0) / filteredSites.length;
    
    return [avgLat, avgLng];
  };

  if (loading) {
    return (
      <div className="h-[600px] rounded-lg border bg-card">
        <div className="p-4 border-b">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="p-4 space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Filters:</span>
            </div>
            
            <select
              value={filters.riskStatus}
              onChange={(e) => setFilters({...filters, riskStatus: e.target.value})}
              className="px-3 py-1 border rounded-md text-sm bg-background"
            >
              <option value="">All Risk Levels</option>
              <option value="High">High Risk</option>
              <option value="Low">Low Risk</option>
            </select>

            <select
              value={filters.siteType}
              onChange={(e) => setFilters({...filters, siteType: e.target.value})}
              className="px-3 py-1 border rounded-md text-sm bg-background"
            >
              <option value="">All Site Types</option>
              {Array.from(new Set(sites.map(s => s.site_type).filter(Boolean))).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <select
              value={filters.authority}
              onChange={(e) => setFilters({...filters, authority: e.target.value})}
              className="px-3 py-1 border rounded-md text-sm bg-background"
            >
              <option value="">All Authorities</option>
              {Array.from(new Set(sites.map(s => s.authority).filter(Boolean))).map(auth => (
                <option key={auth} value={auth}>{auth}</option>
              ))}
            </select>

            <div className="ml-auto text-sm text-muted-foreground">
              Showing {filteredSites.length} of {sites.length} sites
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map */}
      <Card>
        <CardContent className="p-0">
          <div className="h-[600px] rounded-lg overflow-hidden">
            <MapContainer
              center={calculateCenter()}
              zoom={filteredSites.length > 0 ? 8 : 2}
              style={{ height: '100%', width: '100%' }}
              className="rounded-lg"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {filteredSites.map((site) => (
                <Marker
                  key={site.id}
                  position={[site.latitude, site.longitude]}
                >
                  <Popup className="custom-popup">
                    <div className="p-2 min-w-[250px]">
                      <div className="font-semibold text-lg mb-2">{site.site_name}</div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Coordinates:</span>
                          <span>{site.latitude.toFixed(6)}, {site.longitude.toFixed(6)}</span>
                        </div>
                        
                        {site.risk_status && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Risk Status:</span>
                            <Badge variant={site.risk_status === 'High' ? 'destructive' : 'secondary'}>
                              {site.risk_status}
                            </Badge>
                          </div>
                        )}
                        
                        {site.site_type && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Type:</span>
                            <span>{site.site_type}</span>
                          </div>
                        )}
                        
                        {site.authority && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Authority:</span>
                            <span>{site.authority}</span>
                          </div>
                        )}
                        
                        {(site.summer_capacity || site.winter_capacity) && (
                          <div className="border-t pt-2 mt-2">
                            <div className="text-muted-foreground text-xs mb-1">Capacity:</div>
                            {site.summer_capacity && (
                              <div className="flex justify-between text-xs">
                                <span>Summer:</span>
                                <span>{site.summer_capacity}</span>
                              </div>
                            )}
                            {site.winter_capacity && (
                              <div className="flex justify-between text-xs">
                                <span>Winter:</span>
                                <span>{site.winter_capacity}</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="border-t pt-2 mt-2 text-xs text-muted-foreground">
                          Added: {new Date(site.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MapView;