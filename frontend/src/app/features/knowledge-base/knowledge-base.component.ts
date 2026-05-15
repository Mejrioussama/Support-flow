import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { KnowledgeArticle } from '@core/models';
import { KnowledgeBaseService } from '@core/services';

@Component({
  selector: 'app-knowledge-base',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="kb-page">
      <section class="hero-card">
        <div>
          <p class="eyebrow">BASE DE CONNAISSANCE</p>
          <h1>Capitaliser les resolutions support</h1>
          <p class="subtitle">
            Retrouvez les solutions deja formalisees, les articles issus des tickets resolus et les recommandations les plus utiles pour accelerer le traitement.
          </p>
        </div>
        <div class="hero-stats">
          <div class="stat-pill">
            <span>Articles visibles</span>
            <strong>{{ totalArticles }}</strong>
          </div>
          <div class="stat-pill">
            <span>Categories</span>
            <strong>{{ categories.length }}</strong>
          </div>
        </div>
      </section>

      <section class="toolbar-card">
        <label class="search-box">
          <mat-icon>search</mat-icon>
          <input
            [(ngModel)]="searchTerm"
            (keyup.enter)="applyFilters()"
            placeholder="Rechercher un probleme, une cause ou une solution..." />
        </label>

        <label class="select-box">
          <span>Categorie</span>
          <select [(ngModel)]="selectedCategory" (change)="applyFilters()">
            <option value="">Toutes</option>
            <option *ngFor="let category of categories" [value]="category">{{ category }}</option>
          </select>
        </label>

        <div class="toolbar-actions">
          <button mat-stroked-button (click)="resetFilters()">
            <mat-icon>restart_alt</mat-icon>
            Reinitialiser
          </button>
          <button mat-flat-button color="primary" (click)="applyFilters()">
            <mat-icon>filter_alt</mat-icon>
            Filtrer
          </button>
        </div>
      </section>

      <section class="content-card">
        <div class="section-head">
          <div>
            <h2>Articles publies</h2>
            <p>{{ loading ? 'Chargement en cours...' : totalArticles + ' article(s) disponibles' }}</p>
          </div>
        </div>

        <div *ngIf="loading" class="loading-box">
          <mat-spinner diameter="34"></mat-spinner>
          <span>Chargement de la base de connaissance...</span>
        </div>

        <div *ngIf="!loading && articles.length === 0" class="empty-box">
          <mat-icon>library_books</mat-icon>
          <h3>Aucun article pour ce filtre</h3>
          <p>Essayez une autre categorie ou une recherche plus large.</p>
        </div>

        <div *ngIf="!loading && articles.length > 0" class="articles-grid">
          <article *ngFor="let article of articles" class="article-card">
            <div class="article-top">
              <div>
                <div class="article-category">{{ article.category || 'Support' }}</div>
                <h3>{{ article.title }}</h3>
              </div>
              <div class="article-metrics">
                <span><mat-icon>visibility</mat-icon>{{ article.views || 0 }}</span>
                <span><mat-icon>thumb_up</mat-icon>{{ article.helpfulCount || 0 }}</span>
              </div>
            </div>

            <p class="article-summary">{{ article.summary || article.content }}</p>

            <div *ngIf="article.tags?.length" class="tags-row">
              <span *ngFor="let tag of article.tags | slice:0:4" class="tag-chip">{{ tag }}</span>
            </div>

            <div class="article-meta">
              <span>{{ article.authorName || 'Equipe support' }}</span>
              <a *ngIf="article.sourceTicketId" [routerLink]="['/tickets', article.sourceTicketId]">
                {{ article.sourceTicketReference || ('Ticket #' + article.sourceTicketId) }}
              </a>
            </div>

            <details class="article-details">
              <summary>Voir le contenu</summary>
              <pre>{{ article.content }}</pre>
            </details>
          </article>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .kb-page {
      min-height: calc(100vh - 72px);
      padding: 24px;
      background:
        radial-gradient(circle at top left, rgba(0, 227, 253, 0.11), transparent 38%),
        radial-gradient(circle at right center, rgba(90, 104, 255, 0.1), transparent 35%),
        #07101d;
      color: #dbe7fb;
      display: grid;
      gap: 18px;
      font-family: 'Manrope', sans-serif;
    }

    .hero-card,
    .toolbar-card,
    .content-card {
      border-radius: 24px;
      border: 1px solid rgba(103, 232, 249, 0.14);
      background: rgba(10, 18, 33, 0.88);
      box-shadow: 0 22px 60px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(16px);
    }

    .hero-card {
      padding: 28px;
      display: flex;
      justify-content: space-between;
      gap: 20px;
    }

    .eyebrow {
      margin: 0 0 8px;
      color: #67e8f9;
      font-size: 12px;
      letter-spacing: 0.18em;
      font-weight: 700;
    }

    .hero-card h1,
    .section-head h2 {
      margin: 0;
      font-family: 'Space Grotesk', sans-serif;
    }

    .subtitle,
    .section-head p,
    .empty-box p,
    .loading-box span {
      color: #94a3b8;
    }

    .hero-stats {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .stat-pill {
      min-width: 140px;
      padding: 14px 16px;
      border-radius: 18px;
      background: linear-gradient(160deg, rgba(18, 31, 56, 0.96), rgba(9, 15, 29, 0.92));
      border: 1px solid rgba(103, 232, 249, 0.12);
    }

    .stat-pill span {
      display: block;
      color: #94a3b8;
      font-size: 12px;
      margin-bottom: 6px;
    }

    .stat-pill strong {
      font-size: 28px;
      color: #f8fafc;
    }

    .toolbar-card {
      padding: 18px;
      display: grid;
      grid-template-columns: minmax(280px, 1fr) 220px auto;
      gap: 14px;
      align-items: center;
    }

    .search-box,
    .select-box {
      border-radius: 18px;
      border: 1px solid rgba(103, 232, 249, 0.12);
      background: rgba(9, 16, 29, 0.78);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
    }

    .search-box input,
    .select-box select {
      width: 100%;
      background: transparent;
      border: none;
      outline: none;
      color: #dbe7fb;
      font: inherit;
    }

    .select-box {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
    }

    .select-box span {
      font-size: 12px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .toolbar-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }

    .content-card {
      padding: 22px;
      display: grid;
      gap: 18px;
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }

    .loading-box,
    .empty-box {
      min-height: 200px;
      border-radius: 22px;
      border: 1px dashed rgba(103, 232, 249, 0.18);
      background: rgba(6, 10, 20, 0.68);
      display: grid;
      place-items: center;
      text-align: center;
      padding: 20px;
      gap: 12px;
    }

    .empty-box mat-icon {
      font-size: 42px;
      width: 42px;
      height: 42px;
      color: #67e8f9;
    }

    .articles-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
    }

    .article-card {
      border-radius: 22px;
      border: 1px solid rgba(103, 232, 249, 0.1);
      background: linear-gradient(170deg, rgba(18, 28, 48, 0.96), rgba(10, 15, 27, 0.92));
      padding: 18px;
      display: grid;
      gap: 14px;
    }

    .article-top,
    .article-meta {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }

    .article-category {
      color: #67e8f9;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    .article-card h3 {
      margin: 0;
      font-size: 18px;
      line-height: 1.35;
    }

    .article-metrics {
      display: grid;
      gap: 8px;
      color: #94a3b8;
      font-size: 12px;
    }

    .article-metrics span {
      display: flex;
      align-items: center;
      gap: 6px;
      justify-content: flex-end;
    }

    .article-metrics mat-icon {
      width: 15px;
      height: 15px;
      font-size: 15px;
    }

    .article-summary {
      margin: 0;
      color: #c7d2e3;
      line-height: 1.6;
    }

    .tags-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .tag-chip {
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(103, 232, 249, 0.1);
      color: #a5f3fc;
      font-size: 12px;
    }

    .article-meta {
      color: #94a3b8;
      font-size: 12px;
      align-items: center;
    }

    .article-meta a {
      color: #67e8f9;
      text-decoration: none;
    }

    .article-details {
      border-top: 1px solid rgba(103, 232, 249, 0.1);
      padding-top: 12px;
    }

    .article-details summary {
      cursor: pointer;
      color: #e2e8f0;
      font-weight: 600;
    }

    .article-details pre {
      margin: 12px 0 0;
      white-space: pre-wrap;
      color: #cbd5e1;
      font-family: inherit;
      line-height: 1.6;
    }

    @media (max-width: 980px) {
      .hero-card,
      .toolbar-card {
        grid-template-columns: 1fr;
        display: grid;
      }

      .hero-stats,
      .toolbar-actions {
        justify-content: flex-start;
      }
    }
  `]
})
export class KnowledgeBaseComponent implements OnInit {
  articles: KnowledgeArticle[] = [];
  categories: string[] = [];
  searchTerm = '';
  selectedCategory = '';
  loading = true;
  totalArticles = 0;

  constructor(private knowledgeBaseService: KnowledgeBaseService) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadArticles();
  }

  applyFilters(): void {
    if (this.selectedCategory) {
      this.loadByCategory(this.selectedCategory);
      return;
    }

    if (this.searchTerm.trim()) {
      this.loading = true;
      this.knowledgeBaseService.searchArticles(this.searchTerm.trim()).subscribe({
        next: (page) => {
          this.articles = page.content || [];
          this.totalArticles = page.totalElements || this.articles.length;
          this.loading = false;
        },
        error: () => {
          this.articles = [];
          this.totalArticles = 0;
          this.loading = false;
        }
      });
      return;
    }

    this.loadArticles();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = '';
    this.loadArticles();
  }

  private loadArticles(): void {
    this.loading = true;
    this.knowledgeBaseService.listArticles().subscribe({
      next: (page) => {
        this.articles = page.content || [];
        this.totalArticles = page.totalElements || this.articles.length;
        this.loading = false;
      },
      error: () => {
        this.articles = [];
        this.totalArticles = 0;
        this.loading = false;
      }
    });
  }

  private loadCategories(): void {
    this.knowledgeBaseService.getCategories().subscribe({
      next: (categories) => this.categories = categories || [],
      error: () => this.categories = []
    });
  }

  private loadByCategory(category: string): void {
    this.loading = true;
    this.knowledgeBaseService.listByCategory(category).subscribe({
      next: (page) => {
        this.articles = page.content || [];
        this.totalArticles = page.totalElements || this.articles.length;
        this.loading = false;
      },
      error: () => {
        this.articles = [];
        this.totalArticles = 0;
        this.loading = false;
      }
    });
  }
}
