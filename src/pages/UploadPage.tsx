import React from 'react';
import CSVUpload from '@/components/upload/CSVUpload';

const UploadPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Data Upload</h1>
        <p className="text-muted-foreground">
          Upload CSV files containing GIS site data. Validate and import your geospatial data.
        </p>
      </div>
      
      <CSVUpload />
    </div>
  );
};

export default UploadPage;