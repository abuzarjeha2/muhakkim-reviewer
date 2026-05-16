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
  onFileInfo?: (info: { name: string; size: string }) => void;
  extractedText: string;
}

const SUPPORTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.html', '.htm', '.rtf', '.odt', '.md'];
const SUPPORTED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'text/plain',
  'text/html',
  'text/htm',
  'text/markdown',
  'application/rtf',
  'text/rtf',
];

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripRtf(rtf: string): string {
  return rtf
    .replace(/\\[a-z]+\d*\s?/gi, ' ')
    .replace(/[{}\\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export default function FileUpload({ onExtracted, onFileInfo, extractedText }: FileUploadProps) {
  const { t, lang } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string; detail: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getExt = (name: string) => name.toLowerCase().slice(name.lastIndexOf('.'));

  const isSupported = (file: File) => {
    const ext = getExt(file.name);
    return SUPPORTED_EXTENSIONS.includes(ext) || SUPPORTED_MIME.includes(file.type);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };

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
    setError(null);
    if (!isSupported(file)) {
      setError(lang === 'ar'
        ? 'صيغة الملف غير مدعومة. الصيغ المقبولة: PDF, DOC, DOCX, TXT, HTML, RTF, ODT, MD'
        : 'Unsupported file format. Accepted: PDF, DOC, DOCX, TXT, HTML, RTF, ODT, MD');
      return;
    }

    setIsLoading(true);
    let text = '';
    let detail = '';
    const ext = getExt(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();

      if (ext === '.pdf' || file.type === 'application/pdf') {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const pages: string[] = [];
        for (let j = 1; j <= pdf.numPages; j++) {
          const page = await pdf.getPage(j);
          const content = await page.getTextContent();
          pages.push(content.items.map((s: any) => s.str).join(' '));
        }
        text = pages.join('\n');
        detail = lang === 'ar' ? `${pdf.numPages} صفحة` : `${pdf.numPages} pages`;

      } else if (['.docx', '.doc', '.odt'].includes(ext) ||
        ['application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.oasis.opendocument.text'].includes(file.type)) {
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        detail = lang === 'ar' ? `${words} كلمة` : `${words} words`;

      } else if (['.html', '.htm'].includes(ext) || file.type.startsWith('text/html')) {
        const raw = new TextDecoder('utf-8').decode(arrayBuffer);
        text = stripHtml(raw);
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        detail = lang === 'ar' ? `${words} كلمة` : `${words} words`;

      } else if (ext === '.rtf' || file.type === 'application/rtf' || file.type === 'text/rtf') {
        const raw = new TextDecoder('utf-8').decode(arrayBuffer);
        text = stripRtf(raw);
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        detail = lang === 'ar' ? `${words} كلمة` : `${words} words`;

      } else {
        // TXT, MD, and all other plain-text formats
        text = new TextDecoder('utf-8').decode(arrayBuffer);
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        const lines = text.split('\n').length;
        detail = lang === 'ar'
          ? `${words} كلمة • ${lines} سطر`
          : `${words} words • ${lines} lines`;
      }

      if (!text.trim()) {
        setError(lang === 'ar'
          ? 'لم يتم استخراج أي نص من الملف. قد يكون الملف فارغاً أو مشفراً.'
          : 'No text could be extracted. The file may be empty or encrypted.');
        setIsLoading(false);
        return;
      }

      setFileInfo({ name: file.name, size: formatSize(file.size), detail });
      onExtracted(text);
      onFileInfo?.({ name: file.name, size: formatSize(file.size) });
    } catch (err) {
      console.error(err);
      setError(lang === 'ar' ? 'حدث خطأ أثناء معالجة الملف.' : 'Error processing file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    onExtracted("");
    setFileInfo(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const acceptFormats = SUPPORTED_EXTENSIONS.join(',') + ',' + SUPPORTED_MIME.join(',');

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
          accept={acceptFormats}
          onChange={handleFileChange}
          data-testid="input-file"
        />
        <UploadCloud className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">{t('upload_drag')}</p>
        <p className="text-sm text-muted-foreground mb-3">{t('upload_accept')}</p>

        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {['PDF', 'DOCX', 'DOC', 'TXT', 'HTML', 'RTF', 'ODT', 'MD'].map(fmt => (
            <span
              key={fmt}
              className="px-2 py-0.5 rounded text-xs font-mono border"
              style={{ borderColor: 'hsl(var(--primary)/0.4)', color: 'hsl(var(--primary))', background: 'hsl(var(--primary)/0.08)' }}
            >
              {fmt}
            </span>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm border" style={{ background: 'hsl(var(--destructive)/0.1)', borderColor: 'hsl(var(--destructive)/0.4)', color: 'hsl(var(--destructive))' }}>
          {error}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ms-3 text-sm text-muted-foreground">
            {lang === 'ar' ? 'جارٍ استخراج النص...' : 'Extracting text...'}
          </span>
        </div>
      )}

      {fileInfo && !isLoading && (
        <Card className="bg-secondary/20 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <FileCheck2 className="w-8 h-8 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">{fileInfo.name}</p>
                <p className="text-sm text-muted-foreground">{fileInfo.size} &bull; {fileInfo.detail}</p>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={handleClear} data-testid="btn-clear-upload">
              <Trash2 className="w-4 h-4 me-2" />
              {t('upload_clear')}
            </Button>
          </CardContent>
        </Card>
      )}

      {extractedText && (
        <div className="border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="bg-secondary/50 px-4 py-2 border-b border-border flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              {lang === 'ar' ? 'معاينة النص المستخرج' : 'Extracted Text Preview'}
            </span>
            <span className="ms-auto text-xs text-muted-foreground">
              {extractedText.trim().split(/\s+/).filter(Boolean).length}
              {lang === 'ar' ? ' كلمة' : ' words'}
            </span>
          </div>
          <div className="p-4 bg-card max-h-[400px] overflow-y-auto whitespace-pre-wrap font-sans text-sm text-foreground/80 leading-relaxed">
            {extractedText}
          </div>
        </div>
      )}
    </div>
  );
}
