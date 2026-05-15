import React, { useState, useRef } from 'react';
import { useLanguage } from "../../lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { QRCodeSVG } from 'qrcode.react';
import { Download, QrCode } from "lucide-react";

export default function QRGenerator() {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [size, setSize] = useState("256");
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  
  const qrRef = useRef<SVGSVGElement>(null);

  const downloadQR = () => {
    if (!qrRef.current) return;
    
    const svg = qrRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = parseInt(size);
      canvas.height = parseInt(size);
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = "qrcode.png";
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label>{t('qr_url')}</Label>
          <Input 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            placeholder="https://example.com" 
            className="bg-card"
          />
        </div>

        <div className="space-y-2">
          <Label>{t('qr_size')}</Label>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger className="bg-card">
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="128">128x128</SelectItem>
              <SelectItem value="256">256x256</SelectItem>
              <SelectItem value="512">512x512</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Foreground</Label>
            <div className="flex items-center gap-2">
              <Input 
                type="color" 
                value={fgColor} 
                onChange={(e) => setFgColor(e.target.value)} 
                className="w-12 h-10 p-1 cursor-pointer bg-card"
              />
              <span className="font-mono text-sm">{fgColor}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Background</Label>
            <div className="flex items-center gap-2">
              <Input 
                type="color" 
                value={bgColor} 
                onChange={(e) => setBgColor(e.target.value)} 
                className="w-12 h-10 p-1 cursor-pointer bg-card"
              />
              <span className="font-mono text-sm">{bgColor}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl bg-card/50">
        {text ? (
          <>
            <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
              <QRCodeSVG 
                value={text} 
                size={parseInt(size)} 
                fgColor={fgColor} 
                bgColor={bgColor} 
                ref={qrRef}
                level="H"
                includeMargin={true}
              />
            </div>
            <p className="text-sm font-mono text-muted-foreground break-all text-center max-w-full mb-6">
              {text}
            </p>
            <Button onClick={downloadQR} className="w-full max-w-xs" variant="secondary">
              <Download className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
              {t('qr_download')}
            </Button>
          </>
        ) : (
          <div className="text-center text-muted-foreground flex flex-col items-center">
            <QrCode className="w-16 h-16 mb-4 opacity-20" />
            <p>Enter text or URL to generate QR code</p>
          </div>
        )}
      </div>
    </div>
  );
}