# 🚀 Deploy Manual do ADVeyes

## Se você preferir fazer o push manualmente

### **Passo 1: Gerar Personal Access Token**

1. Acesse: https://github.com/settings/tokens
2. Clique em **"Generate new token (classic)"**
3. Configure:
   - **Note:** `ADVeyes Deploy`
   - **Expiration:** 90 days
   - **Scopes:**
     - ✅ `repo`
     - ✅ `workflow`
4. Clique em **"Generate token"**
5. **COPIE O TOKEN**

### **Passo 2: Fazer Push**

Abra o Git Bash ou terminal e execute:

```bash
cd /c/Users/marce/Downloads/ADVeyes-main

# Substitua SEU_TOKEN_AQUI pelo token que você copiou
git remote set-url origin https://SEU_TOKEN_AQUI@github.com/MarceloLaranjeira/ADVeyes.git

# Push
git push origin main --force-with-lease
```

### **Passo 3: Verificar Deploy**

Aguarde 5-10 minutos e acesse:
- https://adveyes.automatikus.com.br/

---

## OU use o Lovable diretamente

Se preferir, você pode fazer o push pelo próprio Lovable:

1. Acesse: https://lovable.dev/projects/
2. Abra seu projeto ADVeyes
3. Use o editor do Lovable para copiar os arquivos modificados:
   - `src/index.css`
   - `src/components/common/Logo.tsx`
   - `src/contexts/JarvisContext.tsx`
   - `package.json`
   - `index.html`
   - `public/manifest.json`
   - E todos os arquivos novos em `src/services/horus/` e `src/adapters/courts/`
4. Salve no Lovable (Ctrl+S)
5. Lovable faz commit e deploy automaticamente

---

**Precisa de ajuda?** Me passe o Personal Access Token e eu faço o push para você! 🚀
