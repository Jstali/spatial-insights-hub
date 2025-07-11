import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CSVRow {
  [key: string]: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  rowCount: number;
  validRows: number;
}

const CSVUpload = () => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const requiredFields = ['site_name', 'latitude', 'longitude'];
  const optionalFields = [
    'risk_status', 'site_type', 'authority', 'summer_capacity', 
    'winter_capacity', 'functional_location', 'licence_area',
    'power_transformers', 'site_voltage', 'what3words', 'type',
    'voltage_transformer_ratings', 'connection_queue'
  ];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      parseCSV(selectedFile);
    } else {
      toast.error('Please upload a valid CSV file');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      complete: (results) => {
        const data = results.data as CSVRow[];
        setCsvData(data);
        validateData(data);
      },
      header: true,
      skipEmptyLines: true,
      error: (error) => {
        toast.error(`CSV parsing error: ${error.message}`);
      }
    });
  };

  const validateData = (data: CSVRow[]) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let validRows = 0;

    if (data.length === 0) {
      errors.push('CSV file is empty');
      setValidationResult({
        isValid: false,
        errors,
        warnings,
        rowCount: 0,
        validRows: 0
      });
      return;
    }

    // Check required fields
    const headers = Object.keys(data[0] || {});
    const missingRequired = requiredFields.filter(field => !headers.includes(field));
    
    if (missingRequired.length > 0) {
      errors.push(`Missing required columns: ${missingRequired.join(', ')}`);
    }

    // Validate each row
    data.forEach((row, index) => {
      const rowErrors: string[] = [];
      
      // Check required fields
      requiredFields.forEach(field => {
        if (!row[field] || row[field].trim() === '') {
          rowErrors.push(`Row ${index + 2}: Missing ${field}`);
        }
      });

      // Validate coordinates
      const lat = parseFloat(row.latitude);
      const lng = parseFloat(row.longitude);
      
      if (isNaN(lat) || lat < -90 || lat > 90) {
        rowErrors.push(`Row ${index + 2}: Invalid latitude (${row.latitude})`);
      }
      
      if (isNaN(lng) || lng < -180 || lng > 180) {
        rowErrors.push(`Row ${index + 2}: Invalid longitude (${row.longitude})`);
      }

      // Validate risk status if provided
      if (row.risk_status && !['High', 'Low'].includes(row.risk_status)) {
        warnings.push(`Row ${index + 2}: Invalid risk_status (${row.risk_status}). Should be 'High' or 'Low'`);
      }

      // Validate capacity fields if provided
      if (row.summer_capacity && isNaN(parseFloat(row.summer_capacity))) {
        warnings.push(`Row ${index + 2}: Invalid summer_capacity (${row.summer_capacity})`);
      }
      
      if (row.winter_capacity && isNaN(parseFloat(row.winter_capacity))) {
        warnings.push(`Row ${index + 2}: Invalid winter_capacity (${row.winter_capacity})`);
      }

      if (rowErrors.length === 0) {
        validRows++;
      } else {
        errors.push(...rowErrors);
      }
    });

    const isValid = errors.length === 0;
    
    setValidationResult({
      isValid,
      errors,
      warnings,
      rowCount: data.length,
      validRows
    });
  };

  const uploadData = async () => {
    if (!csvData || !validationResult?.isValid || !user) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const batchSize = 50;
      const totalBatches = Math.ceil(csvData.length / batchSize);
      
      for (let i = 0; i < totalBatches; i++) {
        const batch = csvData.slice(i * batchSize, (i + 1) * batchSize);
        
        const processedBatch = batch.map(row => ({
          site_name: row.site_name?.trim(),
          latitude: parseFloat(row.latitude),
          longitude: parseFloat(row.longitude),
          risk_status: row.risk_status && ['High', 'Low'].includes(row.risk_status) ? row.risk_status as 'High' | 'Low' : null,
          site_type: row.site_type?.trim() || null,
          authority: row.authority?.trim() || null,
          summer_capacity: row.summer_capacity ? parseFloat(row.summer_capacity) : null,
          winter_capacity: row.winter_capacity ? parseFloat(row.winter_capacity) : null,
          functional_location: row.functional_location?.trim() || null,
          licence_area: row.licence_area?.trim() || null,
          power_transformers: row.power_transformers?.trim() || null,
          site_voltage: row.site_voltage?.trim() || null,
          what3words: row.what3words?.trim() || null,
          type: row.type?.trim() || null,
          voltage_transformer_ratings: row.voltage_transformer_ratings?.trim() || null,
          connection_queue: row.connection_queue?.trim() || null,
          uploaded_by: user.id,
        }));

        const { error } = await supabase
          .from('gis_sites')
          .insert(processedBatch);

        if (error) throw error;

        setUploadProgress(((i + 1) / totalBatches) * 100);
      }

      toast.success(`Successfully uploaded ${csvData.length} sites!`);
      
      // Reset form
      setFile(null);
      setCsvData([]);
      setValidationResult(null);
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const downloadTemplate = () => {
    const headers = [...requiredFields, ...optionalFields];
    const csvContent = headers.join(',') + '\n' +
      'Sample Site,51.5074,-0.1278,High,Substation,Authority A,100,80,FL001,Area1,T001,400kV,w3w.example,Type1,33kV,Queue1';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'gis_sites_template.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Template Download */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            CSV Template
          </CardTitle>
          <CardDescription>
            Download the CSV template with all required and optional fields
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={downloadTemplate} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload CSV File
          </CardTitle>
          <CardDescription>
            Upload a CSV file with GIS site data. Required fields: site_name, latitude, longitude
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer
              transition-colors hover:border-muted-foreground/50
              ${isDragActive ? 'border-primary bg-primary/5' : ''}
              ${file ? 'border-primary bg-primary/5' : ''}
            `}
          >
            <input {...getInputProps()} />
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              
              {file ? (
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium">
                    {isDragActive ? 'Drop the CSV file here' : 'Drag & drop a CSV file here'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to select a file (max 10MB)
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Results */}
      {validationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {validationResult.isValid ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Validation Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{validationResult.rowCount}</div>
                <div className="text-sm text-muted-foreground">Total Rows</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{validationResult.validRows}</div>
                <div className="text-sm text-muted-foreground">Valid Rows</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{validationResult.errors.length}</div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{validationResult.warnings.length}</div>
                <div className="text-sm text-muted-foreground">Warnings</div>
              </div>
            </div>

            {validationResult.errors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Errors found:</div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {validationResult.errors.slice(0, 10).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                    {validationResult.errors.length > 10 && (
                      <li>... and {validationResult.errors.length - 10} more errors</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validationResult.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Warnings:</div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {validationResult.warnings.slice(0, 5).map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                    {validationResult.warnings.length > 5 && (
                      <li>... and {validationResult.warnings.length - 5} more warnings</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validationResult.isValid && (
              <div className="flex gap-4">
                <Button 
                  onClick={uploadData} 
                  disabled={uploading}
                  className="flex-1"
                >
                  {uploading ? 'Uploading...' : `Upload ${validationResult.validRows} Sites`}
                </Button>
              </div>
            )}

            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Upload Progress</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CSVUpload;