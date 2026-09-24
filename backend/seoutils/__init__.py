"""
SEO Metadata Generator for Situska

Generates dynamic, server-side rendered HTML with proper metadata for:
- Homepage (situska.com)
- User websites (demo-kopi-senja.situska.com)
- Articles (situska.com/cara-membuat-website...)
- Platform articles (public Buildza articles)

All metadata is generated server-side so crawlers (WhatsApp, Facebook, etc.)
can see the correct content without needing JavaScript execution.
"""

import re
import json
from typing import Optional, Dict, Any
from datetime import datetime


class SEOGenerator:
    """Generate SEO metadata and pre-rendered HTML for public pages."""
    
    # Default fallback values
    DEFAULT_SITE_TITLE = "Buat Website Usaha Gratis Tanpa Coding | Situska"
    DEFAULT_SITE_DESCRIPTION = "Buat website usaha profesional tanpa coding bersama Situska. Tambahkan produk, pilih tampilan, lalu publish website usaha Anda dengan mudah."
    DEFAULT_SITE_IMAGE = "https://situska.com/assets/showcase/kopi-senja-cover.png"
    DEFAULT_ARTICLE_IMAGE = "https://situska.com/assets/og-article-default.jpg"
    DEFAULT_WEBSITE_IMAGE = "https://situska.com/assets/og-website-default.jpg"
    BASE_URL = "https://situska.com"
    
    @staticmethod
    def escape_html(text: Optional[str]) -> str:
        """Escape special characters to prevent XSS."""
        if not text:
            return ""
        return (str(text)
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;")
                .replace("'", "&#x27;"))
    
    @staticmethod
    def generate_homepage_metadata() -> Dict[str, Any]:
        """Generate metadata for homepage (situska.com)."""
        return {
            "title": SEOGenerator.DEFAULT_SITE_TITLE,
            "description": SEOGenerator.DEFAULT_SITE_DESCRIPTION,
            "image": SEOGenerator.DEFAULT_SITE_IMAGE,
            "url": f"{SEOGenerator.BASE_URL}/",
            "type": "website",
            "robots": "index, follow",
            "canonical": f"{SEOGenerator.BASE_URL}/",
            "schema": {
                "@context": "https://schema.org",
                "@type": "WebApplication",
                "name": "Situska",
                "url": SEOGenerator.BASE_URL,
                "description": SEOGenerator.DEFAULT_SITE_DESCRIPTION,
                "applicationCategory": "BusinessApplication",
                "operatingSystem": "Web",
                "offers": {
                    "@type": "Offer",
                    "price": "0",
                    "priceCurrency": "IDR"
                }
            }
        }
    
    @staticmethod
    def generate_user_website_metadata(
        business_name: str,
        category: str = "",
        description: str = "",
        cover_image_url: str = "",
        logo_url: str = "",
        slug: str = "",
        seo_title: Optional[str] = None,
        seo_description: Optional[str] = None,
        social_image: Optional[str] = None,
        latitude: float = None,
        longitude: float = None,
        address: str = "",
        city: str = "",
        province: str = "",
        postal_code: str = "",
        phone: str = "",
        whatsapp: str = "",
        email: str = "",
        instagram: str = "",
        facebook: str = "",
        tiktok: str = "",
        maps_url: str = ""
    ) -> Dict[str, Any]:
        """
        Generate metadata for user-generated website.
        
        Priority for title/description/image follows the requirements:
        - Manual SEO > Auto-generated from business data > Default fallback
        """
        site_url = f"https://{slug}.situska.com/"
        
        # Determine title (manual SEO > business name)
        title = seo_title.strip() if seo_title and seo_title.strip() else business_name
        
        # Determine description (manual SEO > description > default)
        desc = seo_description.strip() if seo_description and seo_description.strip() else description
        if not desc:
            city_text = f" di {city}" if city else ""
            desc = f"{business_name} adalah {category}{city_text}. Lihat produk, informasi usaha, lokasi, jam buka, dan cara menghubungi kami."
        
        # Determine image (social image > cover > logo > default)
        img = social_image
        if not img and cover_image_url:
            img = cover_image_url
        if not img and logo_url:
            img = logo_url
        if not img:
            img = SEOGenerator.DEFAULT_WEBSITE_IMAGE
        
        # Convert relative URLs to absolute
        if img and not img.startswith(("http://", "https://")):
            if img.startswith("/"):
                img = f"{SEOGenerator.BASE_URL}{img}"
            else:
                img = img
        
        # Determine business type for schema
        cat_lower = category.lower()
        if any(k in cat_lower for k in ["coffee", "cafe"]):
            business_type = "CafeOrCoffeeShop"
        elif any(k in cat_lower for k in ["restaurant", "makanan", "warung"]):
            business_type = "Restaurant"
        elif any(k in cat_lower for k in ["bakery", "roti"]):
            business_type = "Bakery"
        elif any(k in cat_lower for k in ["barber", "tata rambut"]):
            business_type = "Barbershop"
        elif any(k in cat_lower for k in ["retail", "toko", "fashion"]):
            business_type = "Store"
        elif any(k in cat_lower for k in ["jasa", "service"]):
            business_type = "ProfessionalService"
        else:
            business_type = "LocalBusiness"
        
        # Build schema.org structured data
        schema = {
            "@context": "https://schema.org",
            "@type": business_type,
            "name": SEOGenerator.escape_html(business_name),
            "description": SEOGenerator.escape_html(desc),
            "url": site_url,
            "image": img,
        }
        
        # Add contact info if available
        if phone or whatsapp:
            schema["telephone"] = phone or whatsapp
        if email:
            schema["email"] = email
        
        # Add address if available
        if address or city:
            schema["address"] = {
                "@type": "PostalAddress",
                "streetAddress": address or "",
                "addressLocality": city or "",
                "addressRegion": province or "",
                "postalCode": postal_code or "",
                "addressCountry": "ID"
            }
        
        # Add geo coordinates if available
        if latitude is not None and longitude is not None:
            schema["geo"] = {
                "@type": "GeoCoordinates",
                "latitude": latitude,
                "longitude": longitude
            }
        
        # Add map link if available
        if maps_url:
            schema["hasMap"] = maps_url
        
        # Add social media links
        same_as = [u for u in [instagram, facebook, tiktok] if u]
        if same_as:
            schema["sameAs"] = same_as
        
        return {
            "title": SEOGenerator.escape_html(title),
            "description": SEOGenerator.escape_html(desc),
            "image": img,
            "url": site_url,
            "type": "website",
            "robots": "index, follow",
            "canonical": site_url,
            "schema": schema
        }
    
    @staticmethod
    def generate_article_metadata(
        title: str,
        seo_title: Optional[str] = None,
        excerpt: str = "",
        content: str = "",
        cover_image_url: str = "",
        cover_image_alt: str = "",
        canonical_url: str = "",
        published_at: str = "",
        updated_at: str = "",
        category: str = "",
        author_name: str = "Situska",
        site_business_name: str = ""
    ) -> Dict[str, Any]:
        """
        Generate metadata for blog/article page.
        
        Priority for title/description/image follows requirements.
        """
        # Determine title (SEO title > article title)
        article_title = seo_title.strip() if seo_title and seo_title.strip() else title
        
        # Determine description (excerpt > first 160 chars of content > default)
        desc = excerpt.strip() if excerpt and excerpt.strip() else ""
        if not desc:
            # Strip HTML tags from content
            clean_content = re.sub(r'<[^>]+>', ' ', content)
            if len(clean_content) > 155:
                desc = clean_content[:155].strip() + "..."
            else:
                desc = clean_content.strip()
        
        # Determine image (cover > default article image)
        img = cover_image_url
        if img and not img.startswith(("http://", "https://")):
            if img.startswith("/"):
                img = f"{SEOGenerator.BASE_URL}{img}"
            else:
                img = img
        if not img:
            img = SEOGenerator.DEFAULT_ARTICLE_IMAGE
        
        # Build URL based on context
        url = canonical_url
        if not url:
            if site_business_name:
                # Article on user's website
                slug_normalized = site_business_name.lower().replace(" ", "-").replace(" ", "-")
                article_slug_normalized = title.lower().replace(" ", "-").replace(" ", "-")
                url = f"https://{slug_normalized}.situska.com/artikel/{article_slug_normalized}"
            else:
                # Platform article
                url = f"{SEOGenerator.BASE_URL}/{title.lower().replace(' ', '-')}"
        
        # Build Article schema.org
        schema = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": SEOGenerator.escape_html(article_title),
            "description": SEOGenerator.escape_html(desc),
            "image": img,
            "datePublished": published_at or datetime.now().isoformat(),
            "dateModified": updated_at or datetime.now().isoformat(),
            "author": {
                "@type": "Organization",
                "name": SEOGenerator.escape_html(author_name)
            },
            "mainEntityOfPage": url
        }
        
        # Add publisher if different from author
        if site_business_name and site_business_name != author_name:
            schema["publisher"] = {
                "@type": "Organization",
                "name": SEOGenerator.escape_html(site_business_name)
            }
        
        # Add category/breadcrumb
        if category:
            schema["articleSection"] = SEOGenerator.escape_html(category)
        
        return {
            "title": SEOGenerator.escape_html(article_title),
            "description": SEOGenerator.escape_html(desc),
            "image": img,
            "url": url,
            "type": "article",
            "robots": "index, follow",
            "canonical": url,
            "schema": schema,
            "coverImageAlt": SEOGenerator.escape_html(cover_image_alt)
        }
    
    @staticmethod
    def generate_platform_article_metadata(
        title: str,
        seo_title: Optional[str] = None,
        excerpt: str = "",
        content: str = "",
        cover_image_url: str = "",
        cover_image_alt: str = "",
        category: str = "",
        published_at: str = "",
        updated_at: str = "",
        canonical_url: str = ""
    ) -> Dict[str, Any]:
        """Generate metadata for platform (Buildza/Situska) articles."""
        meta = SEOGenerator.generate_article_metadata(
            title=title,
            seo_title=seo_title,
            excerpt=excerpt,
            content=content,
            cover_image_url=cover_image_url,
            cover_image_alt=cover_image_alt,
            canonical_url=canonical_url or f"{SEOGenerator.BASE_URL}/{title.lower().replace(' ', '-')}",
            published_at=published_at,
            updated_at=updated_at,
            category=category,
            author_name="Tim Redaksi Situska"
        )
        
        # Add breadcrumb schema for platform articles
        # Wrap the article node and its breadcrumb in a single @graph. A copy
        # of the article node is used, because a graph that references itself
        # makes json.dumps raise "Circular reference detected".
        article_node = {k: v for k, v in meta["schema"].items() if k != "@context"}
        breadcrumb_node = {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Beranda", "item": SEOGenerator.BASE_URL},
                {"@type": "ListItem", "position": 2, "name": "Artikel", "item": f"{SEOGenerator.BASE_URL}/artikel"},
                {"@type": "ListItem", "position": 3, "name": SEOGenerator.escape_html(title), "item": meta["url"]},
            ],
        }
        meta["schema"] = {
            "@context": "https://schema.org",
            "@graph": [article_node, breadcrumb_node],
        }

        return meta
    
    @staticmethod
    def html_template(metadata: Dict[str, Any], body_html: str = "") -> str:
        """Generate complete HTML document with metadata."""
        # Escape all values
        title = SEOGenerator.escape_html(metadata.get("title", ""))
        description = SEOGenerator.escape_html(metadata.get("description", ""))
        image = SEOGenerator.escape_html(metadata.get("image", ""))
        url = SEOGenerator.escape_html(metadata.get("url", ""))
        ctype = SEOGenerator.escape_html(metadata.get("type", "website"))
        robots = SEOGenerator.escape_html(metadata.get("robots", "index, follow"))
        canonical = SEOGenerator.escape_html(metadata.get("canonical", ""))
        
        # Encode JSON-LD schema
        schema_json = json.dumps(metadata.get("schema", {}))
        
        # Twitter card
        twitter_card = "summary_large_image"
        twitter_title = title
        twitter_description = description
        twitter_image = image
        
        # Build HTML template
        html_parts = [
            '<!doctype html>',
            '<html lang="id">',
            '<head>',
            '    <meta charset="utf-8" />',
            '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
            '    <meta name="theme-color" content="#0EA5E9" />',
            f'    <meta name="description" content="{description}" />',
            f'    <meta name="robots" content="{robots}" />',
            '    <link rel="preconnect" href="https://fonts.googleapis.com" />',
            '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
            '    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet" />',
            '',
            '    <!-- Canonical URL -->',
            f'    <link rel="canonical" href="{canonical}" />',
            '',
            '    <!-- Open Graph / Facebook -->',
            f'    <meta property="og:title" content="{title}" />',
            f'    <meta property="og:description" content="{description}" />',
            f'    <meta property="og:type" content="{ctype}" />',
            f'    <meta property="og:url" content="{url}" />',
            f'    <meta property="og:image" content="{image}" />',
            '',
            '    <!-- Twitter Card -->',
            f'    <meta name="twitter:card" content="{twitter_card}" />',
            f'    <meta name="twitter:title" content="{twitter_title}" />',
            f'    <meta name="twitter:description" content="{twitter_description}" />',
            f'    <meta name="twitter:image" content="{twitter_image}" />',
            '',
            f'    <title>{title}</title>',
            '',
            '    <!-- Schema.org JSON-LD -->',
            '    <script type="application/ld+json" data-situska-schema>',
            f'    {schema_json}',
            '    </script>',
            '',
            '    <!-- SPA entry assets are served by the real index.html shell -->',
            '</head>',
            '<body>',
            '    <noscript>You need to enable JavaScript to run this app.</noscript>',
            f'    <div id="root">{body_html}</div>',
            '</body>',
            '</html>'
        ]
        
        return '\n'.join(html_parts)
    
    @staticmethod
    def generate_index_html() -> str:
        """Generate index.html for homepage."""
        metadata = SEOGenerator.generate_homepage_metadata()
        # Empty body - React will hydrate
        return SEOGenerator.html_template(metadata, body_html="")


def get_seo_generator():
    """Factory function for SEO generator."""
    return SEOGenerator
