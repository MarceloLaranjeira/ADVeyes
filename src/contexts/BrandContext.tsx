import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
} from "react";
import { useTenant, type TenantBranding } from "@/contexts/TenantContext";
import {
  applyBrandToDocument,
  DEFAULT_BRANDING,
  resolveBranding,
} from "@/lib/brand";

interface BrandContextValue {
  brand: TenantBranding;
  isDefaultBrand: boolean;
}

const BrandContext = createContext<BrandContextValue>({
  brand: DEFAULT_BRANDING,
  isDefaultBrand: true,
});

export const BrandProvider = ({ children }: { children: ReactNode }) => {
  const { currentTenant, host, loading, publicConfig } = useTenant();
  const brandingPending =
    host.mode === "tenant" && loading && publicConfig === null;
  const sourceBrand =
    currentTenant?.branding ?? publicConfig?.branding ?? DEFAULT_BRANDING;
  const brand = useMemo(() => resolveBranding(sourceBrand), [sourceBrand]);

  useLayoutEffect(() => {
    if (!brandingPending) return applyBrandToDocument(document, brand);

    document.documentElement.dataset.brandLoading = "true";
    return () => {
      delete document.documentElement.dataset.brandLoading;
    };
  }, [brand, brandingPending]);

  const value = useMemo(
    () => ({
      brand,
      isDefaultBrand:
        brand.publicName === DEFAULT_BRANDING.publicName &&
        !brand.logoLightPath &&
        !brand.logoDarkPath &&
        !brand.iconPath,
    }),
    [brand],
  );

  if (brandingPending) {
    return (
      <div
        className="brand-bootstrap"
        role="status"
        aria-label="Carregando identidade visual"
      >
        <span className="brand-bootstrap__indicator" />
      </div>
    );
  }

  return (
    <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useBrand = () => useContext(BrandContext);
