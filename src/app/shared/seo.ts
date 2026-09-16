import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

const SITE = 'Mi Tienda';
const DEFAULT_DESC = 'Ropa de algodón hecha en Colombia para mujer y hombre. Envío gratis desde $ 250.000.';

// Título y metadatos por página (pestaña, buscadores y al compartir el enlace).
@Injectable({ providedIn: 'root' })
export class PageMeta {
  private title = inject(Title);
  private meta = inject(Meta);

  set(title: string | null, opts: { description?: string; image?: string | null; type?: 'website' | 'product' } = {}) {
    const full = title ? `${title} · ${SITE}` : SITE;
    const description = opts.description ?? DEFAULT_DESC;
    this.title.setTitle(full);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: full });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: opts.type ?? 'website' });
    this.meta.updateTag({ property: 'og:url', content: location.href });
    if (opts.image) this.meta.updateTag({ property: 'og:image', content: opts.image });
    else this.meta.removeTag("property='og:image'");
  }
}
