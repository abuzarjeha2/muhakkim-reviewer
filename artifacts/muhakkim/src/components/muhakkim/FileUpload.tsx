import React, { useState, useRef } from 'react';
import { useLanguage } from "../../lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UploadCloud, FileText, Trash2, FileCheck2 } from "lucide-react";
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;

interface FileUploadProps {
  onExtracted: (text: string) => void;
  extractedText: string;
}

export default function FileUpload({ onExtracted, extractedText }: FileUploadProps) {
  const { t } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string; pagesOrWords: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setIsLoading(true);
    let text = '';
    let pagesOrWords = '';

    try {
      const arrayBuffer = await file.arrayBuffer();

      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const maxPages = pdf.numPages;
        const countPromises = [];
        for (let j = 1; j <= maxPages; j++) {
          const page = await pdf.getPage(j);
          const txt = await page.getTextContent();
          const pageText = txt.items.map((s: any) => s.str).join('');
          countPromises.push(pageText);
        }
        text = countPromises.join('\n');
        pagesOrWords = `${maxPages} Pages`;
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx')) {
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
        const words = text.trim().split(/\s+/).length;
        pagesOrWords = `${words} Words`;
      } else {
        alert('Unsupported file format. Please upload PDF or DOCX.');
        setIsLoading(false);
        return;
      }

      setFileInfo({
        name: file.name,
        size: formatSize(file.size),
        pagesOrWords
      });
      onExtracted(text);
    } catch (err) {
      console.error(err);
      alert('Error processing file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    onExtracted("");
    setFileInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div 
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-primary bg-primary/10' : 'border-border bg-card/50 hover:bg-card hover:border-primary/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        data-testid="upload-zone"
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
          onChange={handleFileChange}
          data-testid="input-file"
        />
        <UploadCloud className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">{t('upload_drag')}</p>
        <p className="text-sm text-muted-foreground">{t('upload_accept')}</p>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {fileInfo && !isLoading && (
        <Card className="bg-secondary/20 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <FileCheck2 className="w-8 h-8 text-primary" />
              <div>
                <p className="font-medium text-foreground">{fileInfo.name}</p>
                <p className="text-sm text-muted-foreground">{fileInfo.size} • {fileInfo.pagesOrWords}</p>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={handleClear} data-testid="btn-clear-upload">
              <Trash2 className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
              {t('upload_clear')}
            </Button>
          </CardContent>
        </Card>
      )}

      {extractedText && (
        <div className="mt-6 border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="bg-secondary/50 px-4 py-2 border-b border-border flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Preview</span>
          </div>
          <div className="p-4 bg-card max-h-[400px] overflow-y-auto whitespace-pre-wrap font-sans text-sm text-foreground/80 leading-relaxed">
            {extractedText}
          </div>
        </div>
      )}
    </div>
  );
}