import React, { useState } from 'react';
import { useLanguage } from "../../lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, Copy, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StatVariable {
  name: string;
  value: string;
  pvalue: string;
  isSignificant: boolean;
}

export default function StatParser() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [results, setResults] = useState<StatVariable[]>([]);
  const [hasRun, setHasRun] = useState(false);

  const runAnalysis = () => {
    if (!text.trim()) return;

    const lines = text.split('\n');
    const parsed: StatVariable[] = [];

    // Very naive parser for demonstration
    // Looks for patterns like: VariableName 0.45 0.03
    // Or lines containing p=, p<
    lines.forEach(line => {
      const l = line.trim();
      if (!l) return;

      const pMatch = l.match(/p\s*[=<>]\s*(0\.\d+|\.\d+|1\.0+|<0\.\d+)/i) || l.match(/Sig\.?\s*(0\.\d+|\.\d+)/i);
      const valMatch = l.match(/(?:B|β|r|t|F|Mean)\s*=?\s*(-?\d+\.\d+)/i);
      
      // Fallback: look for numbers
      const numbers = l.match(/-?\d+\.\d+/g);

      if (pMatch || (numbers && numbers.length >= 2)) {
        let pval = pMatch ? pMatch[1] : (numbers ? numbers[numbers.length - 1] : "N/A");
        let val = valMatch ? valMatch[1] : (numbers ? numbers[0] : "N/A");
        
        // Clean up pval for comparison
        let numPval = parseFloat(pval.replace(/</g, ''));
        let isSig = !isNaN(numPval) && numPval < 0.05;

        // Try to guess variable name (everything before the first number or symbol)
        let name = l.split(/(?:=|<|>|\d)/)[0].trim() || "Variable";

        // Prevent duplicates in this naive implementation
        if (!parsed.find(p => p.name === name && p.value === val)) {
            parsed.push({
            name: name.substring(0, 30),
            value: val,
            pvalue: pval,
            isSignificant: isSig
            });
        }
      }
    });

    setResults(parsed);
    setHasRun(true);
  };

  const exportTable = () => {
    let md = "| Variable | Value | p-value | Significant |\n|---|---|---|---|\n";
    results.forEach(r => {
      md += `| ${r.name} | ${r.value} | ${r.pvalue} | ${r.isSignificant ? 'Yes' : 'No'} |\n`;
    });
    navigator.clipboard.writeText(md);
    toast({ title: "Table copied as Markdown" });
  };

  const sigCount = results.filter(r => r.isSignificant).length;

  return (
    <div className="space-y-6">
      <Textarea 
        className="min-h-[200px] resize-y font-mono text-sm p-4 bg-card border-border text-foreground"
        placeholder={t('stats_placeholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        data-testid="textarea-stats"
      />

      <div className="flex gap-4">
        <Button onClick={runAnalysis} className="flex-1" data-testid="btn-run-stats">
          <Calculator className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
          {t('stats_run')}
        </Button>
      </div>

      {hasRun && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground text-sm font-medium mb-2">Total Variables</p>
                <p className="text-3xl font-bold text-foreground">{results.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground text-sm font-medium mb-2">Significant (p &lt; 0.05)</p>
                <p className="text-3xl font-bold text-success">{sigCount}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground text-sm font-medium mb-2">Not Significant</p>
                <p className="text-3xl font-bold text-warning">{results.length - sigCount}</p>
              </CardContent>
            </Card>
          </div>

          {results.length > 0 && (
            <Card className="border-border">
              <div className="p-4 border-b border-border flex justify-between items-center bg-secondary/20">
                <h3 className="font-semibold">Parsed Results / النتائج</h3>
                <Button variant="outline" size="sm" onClick={exportTable}>
                  <Copy className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                  Export Markdown
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variable</TableHead>
                    <TableHead>Value / Coeff</TableHead>
                    <TableHead>p-value</TableHead>
                    <TableHead className="text-center">Significant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="font-mono">{r.value}</TableCell>
                      <TableCell className={`font-mono ${r.isSignificant ? 'text-destructive font-bold' : ''}`}>
                        {r.pvalue}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.isSignificant ? 
                          <Check className="w-5 h-5 text-success mx-auto" /> : 
                          <X className="w-5 h-5 text-muted-foreground mx-auto" />
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}