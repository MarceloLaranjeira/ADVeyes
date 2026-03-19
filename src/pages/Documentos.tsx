import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FileText, Upload, Search, Trash2, Download, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { recognizeDocument, type DocumentInfo } from "@/lib/document-recognition";

const tiposDoc = ["Petição", "Contestação", "Recurso", "HC", "Alegações", "Procuração", "Contrato", "Parecer", "Decisão", "Outros"];

const Documentos = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [documentos, setDocumentos] = useState<Record<string, any>[]>([]);
  const [processos, setProcessos] = useState<Record<string, any>[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteFilePath, setDeleteFilePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [recognized, setRecognized] = useState<DocumentInfo | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({ nome: "", tipo: "Petição", processo_id: "" });

  const fetchDocumentos = async () => {
    const { data } = await supabase.from("documentos").select("*").order("created_at", { ascending: false });
    if (data) setDocumentos(data);
  };

  const fetchProcessos = async () => {
    const { data } = await supabase.from("processos").select("id, numero, cliente_nome");
    if (data) setProcessos(data);
  };

  useEffect(() => { fetchDocumentos(); fetchProcessos(); }, []);

  const handleFileChange = async (file: File | null) => {
    setSelectedFile(file);
    setRecognized(null);
    if (!file) return;

    setScanning(true);
    try {
      const info = await recognizeDocument(file);
      setRecognized(info);

      // Auto-fill form with recognized data
      setForm((prev) => ({
        nome: prev.nome || (info.clienteNome ? `${info.tipo || "Documento"} - ${info.clienteNome}` : prev.nome),
        tipo: info.tipo || prev.tipo,
        processo_id: prev.processo_id || (() => {
          if (info.processoNumero) {
            const match = processos.find(p => p.numero === info.processoNumero);
            return match ? String(match.id) : prev.processo_id;
          }
          return prev.processo_id;
        })(),
      }));
    } catch {
      // Silently fail - user can fill manually
    } finally {
      setScanning(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !form.nome.trim()) {
      toast({ title: "Selecione um arquivo e preencha o nome", variant: "destructive" });
      return;
    }
    setLoading(true);

    const fileExt = selectedFile.name.split(".").pop();
    const filePath = `${user!.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from("documentos").upload(filePath, selectedFile);
    if (uploadError) {
      toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const processo = processos.find(p => p.id === form.processo_id);
    const { error } = await supabase.from("documentos").insert({
      nome: form.nome,
      tipo: form.tipo,
      processo_id: form.processo_id || null,
      processo_numero: processo?.numero || null,
      arquivo_path: filePath,
      tamanho: selectedFile.size,
      user_id: user!.id,
    });

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Documento enviado com sucesso!" });
      setForm({ nome: "", tipo: "Petição", processo_id: "" });
      setSelectedFile(null);
      setRecognized(null);
      setShowForm(false);
      fetchDocumentos();
    }
    setLoading(false);
  };

  const handleDownload = async (path: string, nome: string) => {
    const { data, error } = await supabase.storage.from("documentos").download(path);
    if (error || !data) {
      toast({ title: "Erro ao baixar", variant: "destructive" });
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!deleteId || !deleteFilePath) return;
    await supabase.storage.from("documentos").remove([deleteFilePath]);
    const { error } = await supabase.from("documentos").delete().eq("id", deleteId);
    if (error) toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    else { toast({ title: "Documento excluído!" }); fetchDocumentos(); }
    setDeleteId(null);
    setDeleteFilePath(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const filtered = documentos.filter(d =>
    d.nome.toLowerCase().includes(search.toLowerCase()) ||
    (d.processo_numero || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">Documentos</h1>
            <p className="text-muted-foreground text-sm mt-1">Gestão de documentos e peças processuais</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Upload className="w-4 h-4" /> Upload
          </Button>
        </div>

        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar documento..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="bg-card rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Documento</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Processo</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tamanho</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum documento encontrado</td></tr>
              )}
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">{d.nome}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{d.tipo}</td>
                  <td className="p-4 text-sm font-mono text-muted-foreground">{d.processo_numero || "—"}</td>
                  <td className="p-4 text-sm text-muted-foreground">{d.tamanho ? formatSize(d.tamanho) : "—"}</td>
                  <td className="p-4 text-sm text-muted-foreground">{new Date(d.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(d.arquivo_path, d.nome)}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { setDeleteId(d.id); setDeleteFilePath(d.arquivo_path); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Upload Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Upload de Documento</DialogTitle></DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Documento *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Petição Inicial - João Silva" required />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{tiposDoc.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vincular ao Processo</Label>
                <Select value={form.processo_id} onValueChange={(v) => setForm({ ...form, processo_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {processos.map(p => <SelectItem key={p.id} value={p.id}>{p.numero} - {p.cliente_nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Arquivo *</Label>
                <Input
                  ref={fileRef}
                  type="file"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.txt,.odt,.jpg,.jpeg,.png"
                  required
                />
                {scanning && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Analisando documento...
                  </div>
                )}
                {!scanning && recognized && (
                  <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Sparkles className="w-3 h-3" />
                      Reconhecimento automático
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {recognized.tipo && (
                        <Badge variant="secondary" className="text-xs">Tipo: {recognized.tipo}</Badge>
                      )}
                      {recognized.processoNumero && (
                        <Badge variant="secondary" className="text-xs font-mono">Processo: {recognized.processoNumero}</Badge>
                      )}
                      {recognized.clienteNome && (
                        <Badge variant="secondary" className="text-xs">Cliente: {recognized.clienteNome}</Badge>
                      )}
                      {recognized.cpf && (
                        <Badge variant="secondary" className="text-xs font-mono">CPF: {recognized.cpf}</Badge>
                      )}
                      {!recognized.tipo && !recognized.processoNumero && !recognized.clienteNome && (
                        <span className="text-xs text-muted-foreground">Nenhuma informação identificada automaticamente.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setRecognized(null); }}>Cancelar</Button>
                <Button type="submit" disabled={loading || scanning}>{loading ? "Enviando..." : "Enviar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) { setDeleteId(null); setDeleteFilePath(null); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
              <AlertDialogDescription>O arquivo será removido permanentemente.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default Documentos;
