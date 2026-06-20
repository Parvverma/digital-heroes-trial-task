'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Upload, 
  Sliders, 
  Image as ImageIcon, 
  Download, 
  Trash2, 
  AlertCircle, 
  RefreshCw, 
  Sparkles, 
  FileDown, 
  Layers,
  Info,
  ChevronRight,
  Mail,
  ArrowRightLeft
} from 'lucide-react';
import JSZip from 'jszip';

interface ImageFile {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  originalUrl: string;
  optimizedSize: number | null;
  optimizedUrl: string | null;
  optimizedWidth: number | null;
  optimizedHeight: number | null;
  status: 'idle' | 'processing' | 'success' | 'error';
  savingPercent: number | null;
}

export default function Home() {
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  
  // Compression Settings
  const [globalFormat, setGlobalFormat] = useState<string>('image/webp');
  const [globalQuality, setGlobalQuality] = useState<number>(80);
  const [globalScale, setGlobalScale] = useState<number>(100);
  
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  
  // Settings Change Handlers
  const handleFormatChange = (format: string) => {
    setGlobalFormat(format);
    setFiles(prev => prev.map(f => ({ ...f, status: 'idle', optimizedSize: null, savingPercent: null })));
  };

  const handleQualityChange = (quality: number) => {
    setGlobalQuality(quality);
    setFiles(prev => prev.map(f => ({ ...f, status: 'idle', optimizedSize: null, savingPercent: null })));
  };

  const handleScaleChange = (scale: number) => {
    setGlobalScale(scale);
    setFiles(prev => prev.map(f => ({ ...f, status: 'idle', optimizedSize: null, savingPercent: null })));
  };
  
  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Helper: Format file sizes
  const formatSize = (bytes: number | null) => {
    if (bytes === null) return 'Calculating...';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper: Read dimensions of file
  const readImageDimensions = (file: File): Promise<{ width: number; height: number; url: string }> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight, url });
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
    });
  };

  // Process files dropped or chosen
  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const newImages: ImageFile[] = [];
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith('image/')) continue;
      
      const id = Math.random().toString(36).substring(2, 9);
      try {
        const { width, height, url } = await readImageDimensions(file);
        
        newImages.push({
          id,
          file,
          name: file.name,
          originalSize: file.size,
          originalWidth: width,
          originalHeight: height,
          originalUrl: url,
          optimizedSize: null,
          optimizedUrl: null,
          optimizedWidth: null,
          optimizedHeight: null,
          status: 'idle',
          savingPercent: null,
        });
      } catch (e) {
        console.error('Error loading image', file.name, e);
      }
    }
    
    if (newImages.length === 0) return;
    
    setFiles(prev => {
      const updated = [...prev, ...newImages];
      // Select first added image if none is selected
      if (!selectedFileId && updated.length > 0) {
        setSelectedFileId(updated[0].id);
      }
      return updated;
    });
  }, [selectedFileId]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  // Image optimization logic
  const optimizeImage = useCallback((
    imageFile: ImageFile, 
    format: string, 
    quality: number, 
    scale: number
  ): Promise<ImageFile> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = imageFile.originalUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ ...imageFile, status: 'error' });
          return;
        }

        const targetWidth = Math.round(imageFile.originalWidth * (scale / 100));
        const targetHeight = Math.round(imageFile.originalHeight * (scale / 100));
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        // Draw image with smooth scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve({ ...imageFile, status: 'error' });
              return;
            }
            
            // Clean up old optimized URL if it exists
            if (imageFile.optimizedUrl) {
              URL.revokeObjectURL(imageFile.optimizedUrl);
            }
            
            const optimizedUrl = URL.createObjectURL(blob);
            const optimizedSize = blob.size;
            const savingPercent = imageFile.originalSize > 0 
              ? Math.round(((imageFile.originalSize - optimizedSize) / imageFile.originalSize) * 100) 
              : 0;
              
            resolve({
              ...imageFile,
              optimizedSize,
              optimizedUrl,
              optimizedWidth: targetWidth,
              optimizedHeight: targetHeight,
              status: 'success',
              savingPercent: savingPercent > 0 ? savingPercent : 0
            });
          },
          format,
          quality / 100
        );
      };
      img.onerror = () => {
        resolve({ ...imageFile, status: 'error' });
      };
    });
  }, []);

  // Effect: Sequentially optimize idle files
  useEffect(() => {
    const idleFile = files.find(f => f.status === 'idle');
    if (!idleFile) return;
    
    const timer = setTimeout(() => {
      // Mark file as processing
      setFiles(prev => prev.map(f => f.id === idleFile.id ? { ...f, status: 'processing' } : f));
      
      optimizeImage(idleFile, globalFormat, globalQuality, globalScale)
        .then(updatedFile => {
          setFiles(prev => prev.map(f => f.id === idleFile.id ? updatedFile : f));
        })
        .catch(() => {
          setFiles(prev => prev.map(f => f.id === idleFile.id ? { ...f, status: 'error' } : f));
        });
    }, 0);

    return () => clearTimeout(timer);
  }, [files, globalFormat, globalQuality, globalScale, optimizeImage]);

  // Actions
  const handleRemoveFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    setFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target) {
        URL.revokeObjectURL(target.originalUrl);
        if (target.optimizedUrl) URL.revokeObjectURL(target.optimizedUrl);
      }
      const updated = prev.filter(f => f.id !== id);
      
      if (selectedFileId === id) {
        setSelectedFileId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
  };

  const handleDownloadSingle = (image: ImageFile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!image.optimizedUrl) return;
    
    let ext = 'webp';
    if (globalFormat === 'image/jpeg') ext = 'jpg';
    if (globalFormat === 'image/png') ext = 'png';
    
    const baseName = image.name.substring(0, image.name.lastIndexOf('.')) || image.name;
    
    const link = document.createElement('a');
    link.href = image.optimizedUrl;
    link.download = `${baseName}-optimized.${ext}`;
    link.click();
  };

  const handleDownloadAll = async () => {
    const successFiles = files.filter(f => f.status === 'success' && f.optimizedUrl);
    if (successFiles.length === 0) return;
    
    setIsZipping(true);
    const zip = new JSZip();
    
    try {
      for (const f of successFiles) {
        if (!f.optimizedUrl) continue;
        const res = await fetch(f.optimizedUrl);
        const blob = await res.blob();
        
        let ext = 'webp';
        if (globalFormat === 'image/jpeg') ext = 'jpg';
        if (globalFormat === 'image/png') ext = 'png';
        
        const baseName = f.name.substring(0, f.name.lastIndexOf('.')) || f.name;
        zip.file(`${baseName}-optimized.${ext}`, blob);
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'optihero-optimized-images.zip';
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error generating ZIP', e);
    } finally {
      setIsZipping(false);
    }
  };

  const handleClearAll = () => {
    files.forEach(f => {
      URL.revokeObjectURL(f.originalUrl);
      if (f.optimizedUrl) URL.revokeObjectURL(f.optimizedUrl);
    });
    setFiles([]);
    setSelectedFileId(null);
  };

  // Get currently selected image
  const selectedImage = files.find(f => f.id === selectedFileId);

  // Compute overall savings
  const totalOriginalSize = files.reduce((acc, f) => acc + f.originalSize, 0);
  const totalOptimizedSize = files.reduce((acc, f) => acc + (f.optimizedSize || 0), 0);
  const totalSavingPercent = totalOriginalSize > 0 
    ? Math.round(((totalOriginalSize - totalOptimizedSize) / totalOriginalSize) * 100) 
    : 0;

  return (
    <div className="flex-1 flex flex-col justify-between py-12 px-4 md:px-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <header className="flex flex-col items-center text-center mb-10 mt-4 animate-float">
        <div className="flex items-center gap-3 mb-3 bg-purple-500/10 border border-purple-500/20 px-4 py-1.5 rounded-full">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <span className="text-xs md:text-sm font-semibold tracking-wider text-purple-300 uppercase">Secure Client-Side Converter</span>
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-4 gradient-text">
          OptiHero
        </h1>
        <p className="text-zinc-400 max-w-xl text-sm md:text-base leading-relaxed">
          Compress, resize, and convert your images instantly without compromising visual fidelity. Your files are processed entirely in-browser and are never uploaded to a server.
        </p>
      </header>

      {/* Main App Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
        
        {/* Left Column - Uploder & File list */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Drag & Drop Container */}
          <div 
            className={`relative rounded-3xl border-2 border-dashed p-8 md:p-12 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer text-center glass-panel ${
              dragActive 
                ? 'border-purple-500 bg-purple-500/5 scale-[0.99]' 
                : 'border-zinc-800 hover:border-zinc-700'
            }`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input 
              id="file-input" 
              type="file" 
              multiple 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileInput}
            />
            
            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 text-purple-400 group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8" />
            </div>
            
            <h3 className="text-lg font-bold text-zinc-100 mb-1">
              Drag & drop images here
            </h3>
            <p className="text-xs text-zinc-500 max-w-xs mb-3">
              Supports JPEG, PNG, WebP, SVG, and GIF. Select multiple files for batch processing.
            </p>
            <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl border border-zinc-700 transition">
              Browse Files
            </button>
          </div>

          {/* Uploaded File List Dashboard */}
          {files.length > 0 && (
            <div className="glass-panel rounded-3xl overflow-hidden flex flex-col border border-zinc-800">
              <div className="p-5 border-b border-zinc-800/60 flex items-center justify-between bg-zinc-900/40">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-zinc-200 text-sm md:text-base">
                    Workspace ({files.length} {files.length === 1 ? 'image' : 'images'})
                  </h3>
                </div>
                <button 
                  onClick={handleClearAll}
                  className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>
              </div>

              {/* Stats Panel */}
              <div className="grid grid-cols-3 divide-x divide-zinc-800/60 border-b border-zinc-800/60 bg-zinc-900/20 text-center py-4">
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Original Size</p>
                  <p className="text-xs md:text-sm font-bold text-zinc-300">{formatSize(totalOriginalSize)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Optimized Size</p>
                  <p className="text-xs md:text-sm font-bold text-purple-400">{formatSize(totalOptimizedSize)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Savings</p>
                  <p className="text-xs md:text-sm font-bold text-emerald-400">
                    {totalSavingPercent > 0 ? `-${totalSavingPercent}%` : '0%'}
                  </p>
                </div>
              </div>

              {/* Scrollable File List */}
              <div className="max-h-[300px] overflow-y-auto divide-y divide-zinc-800/40">
                {files.map((img) => {
                  const isSelected = img.id === selectedFileId;
                  return (
                    <div 
                      key={img.id}
                      onClick={() => setSelectedFileId(img.id)}
                      className={`p-4 flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-purple-950/20 border-l-2 border-purple-500' 
                          : 'hover:bg-zinc-850/40 border-l-2 border-transparent'
                      }`}
                    >
                      {/* Image Thumbnail & Name */}
                      <div className="flex items-center gap-3 overflow-hidden flex-1">
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 flex-shrink-0">
                          <img 
                            src={img.originalUrl} 
                            alt={img.name} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-zinc-200 truncate">{img.name}</p>
                          <p className="text-[10px] text-zinc-500">
                            {img.originalWidth}x{img.originalHeight} px • {formatSize(img.originalSize)}
                          </p>
                        </div>
                      </div>

                      {/* Compression Status & Savings */}
                      <div className="flex items-center gap-4">
                        {img.status === 'processing' && (
                          <span className="flex items-center gap-1.5 text-xs text-purple-400 font-medium">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Optimizing
                          </span>
                        )}

                        {img.status === 'success' && img.optimizedSize && (
                          <div className="text-right">
                            <p className="text-xs font-bold text-emerald-400">-{img.savingPercent}%</p>
                            <p className="text-[10px] text-zinc-500">{formatSize(img.optimizedSize)}</p>
                          </div>
                        )}

                        {img.status === 'error' && (
                          <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Failed
                          </span>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1">
                          {img.status === 'success' && img.optimizedUrl && (
                            <button
                              onClick={(e) => handleDownloadSingle(img, e)}
                              className="p-1.5 text-zinc-400 hover:text-purple-400 hover:bg-zinc-800 rounded-lg transition"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => handleRemoveFile(img.id, e)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions Footer */}
              <div className="p-4 bg-zinc-900/60 border-t border-zinc-800/80 flex flex-col sm:flex-row gap-3 justify-end items-center">
                <button
                  disabled={isZipping || files.filter(f => f.status === 'success').length === 0}
                  onClick={handleDownloadAll}
                  className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  {isZipping ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Creating ZIP Archive...
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4" />
                      Download All as ZIP
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Right Column - Parameters & Live Preview */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Settings Box */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col gap-6">
            <div className="flex items-center gap-2 border-b border-zinc-800/60 pb-4">
              <Sliders className="w-5 h-5 text-purple-400" />
              <h3 className="font-bold text-zinc-100 text-sm md:text-base">Optimization Settings</h3>
            </div>

            {/* Target Format */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-400 flex justify-between items-center">
                Format
                <span className="text-[10px] font-normal text-zinc-600">Change applies to all</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'image/webp', label: 'WebP' },
                  { value: 'image/jpeg', label: 'JPEG' },
                  { value: 'image/png', label: 'PNG' }
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => handleFormatChange(item.value)}
                    className={`py-2 rounded-xl text-xs font-bold transition border ${
                      globalFormat === item.value 
                        ? 'bg-purple-600/10 border-purple-500 text-purple-300 shadow-sm' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality Slider (only visible/useful for webp and jpeg) */}
            {globalFormat !== 'image/png' && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs font-bold text-zinc-400">
                  <span>Compression Quality</span>
                  <span className="text-purple-400 text-sm">{globalQuality}%</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="100" 
                  value={globalQuality} 
                  onChange={(e) => handleQualityChange(parseInt(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <p className="text-[10px] text-zinc-600 leading-tight">
                  Lowering quality reduces file size but can introduce visual artifacts. {globalQuality >= 80 ? 'Recommended for high quality.' : 'Optimized for high compression.'}
                </p>
              </div>
            )}

            {/* Resize Slider */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs font-bold text-zinc-400">
                <span>Rescale Dimensions</span>
                <span className="text-purple-400 text-sm">{globalScale}%</span>
              </div>
              <input 
                type="range" 
                min="10" 
                max="100" 
                step="5"
                value={globalScale} 
                onChange={(e) => handleScaleChange(parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <p className="text-[10px] text-zinc-600 leading-tight flex justify-between">
                <span>10% (Tiny)</span>
                <span>50% (Medium)</span>
                <span>100% (Original Width)</span>
              </p>
            </div>
          </div>

          {/* Live Comparison Viewer */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-zinc-800/60 pb-4">
              <ImageIcon className="w-5 h-5 text-purple-400" />
              <h3 className="font-bold text-zinc-100 text-sm md:text-base">Live Comparison</h3>
            </div>

            {selectedImage ? (
              <div className="flex flex-col gap-4">
                {/* Stats Header */}
                <div className="flex items-center justify-between text-xs">
                  <div className="overflow-hidden max-w-[200px]">
                    <p className="font-bold text-zinc-300 truncate">{selectedImage.name}</p>
                    <p className="text-[10px] text-zinc-500">
                      {selectedImage.originalWidth}x{selectedImage.originalHeight} px 
                      {selectedImage.optimizedWidth && ` → ${selectedImage.optimizedWidth}x${selectedImage.optimizedHeight} px`}
                    </p>
                  </div>
                  {selectedImage.savingPercent !== null && selectedImage.savingPercent > 0 && (
                    <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                      Saved {selectedImage.savingPercent}%
                    </span>
                  )}
                </div>

                {/* Slider Render */}
                {selectedImage.status === 'success' && selectedImage.optimizedUrl ? (
                  <ComparisonSlider 
                    originalUrl={selectedImage.originalUrl}
                    optimizedUrl={selectedImage.optimizedUrl}
                    originalSizeText={formatSize(selectedImage.originalSize)}
                    optimizedSizeText={formatSize(selectedImage.optimizedSize)}
                  />
                ) : (
                  <div className="h-[400px] rounded-2xl border border-zinc-800/60 bg-zinc-950 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                    <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mb-3" />
                    <p className="text-xs font-bold text-zinc-400">Processing live preview...</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Applying format and compression quality settings</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[260px] rounded-2xl border border-zinc-800/60 bg-zinc-950/40 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                <Info className="w-8 h-8 text-zinc-700 mb-2" />
                <p className="text-xs font-bold text-zinc-400">No Image Selected</p>
                <p className="text-[10px] text-zinc-600 mt-1 max-w-[200px]">
                  Drop or browse images and select one from the workspace to compare compression side-by-side.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer Area */}
      <footer className="w-full border-t border-zinc-850/80 pt-8 mt-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
        
        {/* Contact / Bio details */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-center md:justify-start gap-2.5 text-zinc-200 font-bold text-lg md:text-xl">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-purple-400 shadow-inner">
              <span className="font-extrabold text-sm">PV</span>
            </div>
            Parv Verma
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-sm md:text-base text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-purple-400" />
              parvverma299@gmail.com
            </span>
            <span className="hidden sm:inline text-zinc-700">•</span>
            <span className="text-zinc-500 font-medium">Senior Web Engineer</span>
          </div>
        </div>

        {/* Built for Digital Heroes button */}
        <div>
          <a
            href="https://digitalheroesco.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-950 border border-purple-500/50 text-purple-200 text-xs font-bold tracking-wider uppercase transition-all duration-300 hover:text-white hover:border-purple-400 animate-pulse-glow"
          >
            {/* Soft inner glow */}
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600/10 to-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            
            Built for Digital Heroes
            <ChevronRight className="w-4 h-4 text-purple-400 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </footer>
    </div>
  );
}

// Draggable comparison slider component
interface ComparisonSliderProps {
  originalUrl: string;
  optimizedUrl: string;
  originalSizeText: string;
  optimizedSizeText: string;
}

function ComparisonSlider({
  originalUrl,
  optimizedUrl,
  originalSizeText,
  optimizedSizeText
}: ComparisonSliderProps) {
  const [sliderPos, setSliderPos] = useState<number>(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<boolean>(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percentage);
  }, []);

  const onMouseDown = useCallback(() => {
    isDragging.current = true;
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      handleMove(e.clientX);
    };
    
    const onMouseUp = () => {
      isDragging.current = false;
    };
    
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onMouseUp);
    };
  }, [handleMove]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[320px] md:h-[400px] rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 select-none cursor-ew-resize group"
      onMouseDown={onMouseDown}
      onTouchStart={onMouseDown}
    >
      {/* Original Image (Left side) */}
      <img 
        src={originalUrl} 
        alt="Original Image" 
        className="absolute inset-0 w-full h-full object-contain pointer-events-none p-2"
      />
      
      {/* Optimized Image (Right side clipped dynamically) */}
      <div 
        className="absolute inset-0 pointer-events-none p-2"
        style={{
          clipPath: `polygon(${sliderPos}% 0, 100% 0, 100% 100%, ${sliderPos}% 100%)`
        }}
      >
        <img 
          src={optimizedUrl} 
          alt="Optimized Image" 
          className="absolute inset-0 w-full h-full object-contain"
        />
      </div>

      {/* Vertical Slider Bar */}
      <div 
        className="absolute top-0 bottom-0 w-[2px] bg-purple-500 z-10 pointer-events-none"
        style={{ left: `${sliderPos}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-zinc-900 border-2 border-purple-500 flex items-center justify-center shadow-lg text-purple-400 select-none pointer-events-auto">
          <ArrowRightLeft className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Info Badges */}
      <div className="absolute top-4 left-4 px-2 py-1 rounded bg-black/60 text-[10px] font-semibold text-zinc-300 z-20 backdrop-blur-md border border-zinc-800 pointer-events-none uppercase tracking-wide">
        Original: {originalSizeText}
      </div>
      <div className="absolute top-4 right-4 px-2 py-1 rounded bg-purple-950/70 text-[10px] font-semibold text-purple-200 z-20 backdrop-blur-md border border-purple-500/30 pointer-events-none uppercase tracking-wide">
        Optimized: {optimizedSizeText}
      </div>
      
      {/* Drag Helper Tip */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-black/60 text-[9px] text-zinc-400 font-bold tracking-wider z-20 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-350 pointer-events-none uppercase">
        Drag slider to compare quality
      </div>
    </div>
  );
}
