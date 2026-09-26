import React from 'react';
import { Play } from 'lucide-react';

export interface ProductMedia {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl: string;
}

interface ProductGalleryProps {
  mediaChoices: ProductMedia[];
  activeMedia: ProductMedia | null;
  selectedColor: string;
  mainImageUrl: string;
  blurImageUrl: string;
  productTitle: string;
  onSelectMedia: (id: string) => void;
}

const getYouTubeEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&rel=0` : null;
};

export const ProductGallery: React.FC<ProductGalleryProps> = ({
  mediaChoices,
  activeMedia,
  selectedColor,
  mainImageUrl,
  blurImageUrl,
  productTitle,
  onSelectMedia,
}) => {
  return (
    <div className="relative min-h-[340px] overflow-hidden bg-chumbo-950 p-3 sm:min-h-[440px] lg:min-h-0">
      {blurImageUrl && (
        <img
          src={blurImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl"
          aria-hidden="true"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-chumbo-950/35 via-chumbo-950/55 to-chumbo-950" />
      <div
        className={`relative z-10 flex flex-col-reverse sm:grid h-full w-full p-2 sm:p-5 ${
          mediaChoices.length > 1 ? 'sm:grid-cols-[76px_minmax(0,1fr)]' : ''
        }`}
      >
        {mediaChoices.length > 1 && (
          <div className="flex shrink-0 flex-row gap-2 overflow-x-auto border-t sm:border-t-0 sm:border-r border-white/10 bg-chumbo-950/80 p-2 backdrop-blur-md sm:flex-col sm:overflow-y-auto no-scrollbar">
            {mediaChoices.map((media, index) => {
              const isCurrent = media.id === activeMedia?.id;
              return (
                <button
                  type="button"
                  key={media.id}
                  onClick={() => onSelectMedia(media.id)}
                  onMouseEnter={() => onSelectMedia(media.id)}
                  className={`relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-xl border-2 bg-chumbo-900 p-0.5 transition-all duration-150 ${
                    isCurrent
                      ? 'border-laser-400 shadow-[0_0_0_2px_rgba(34,211,238,0.25)] scale-105'
                      : 'border-chumbo-700 opacity-70 hover:border-chumbo-500 hover:opacity-100'
                  }`}
                  aria-label={
                    media.type === 'video'
                      ? 'Ver vídeo do produto'
                      : `Ver foto ${index + 1} da cor ${selectedColor}`
                  }
                >
                  {media.thumbnailUrl && (
                    <img src={media.thumbnailUrl} alt="" className="h-full w-full rounded-lg object-cover" />
                  )}
                  {media.type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-laser-400 text-chumbo-950 shadow-md">
                        <Play className="h-3 w-3 fill-chumbo-950 translate-x-0.5" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex min-h-0 items-center justify-center p-2 sm:p-4">
          <div className="relative aspect-square w-full max-w-[580px] overflow-hidden rounded-2xl border border-chumbo-800 bg-chumbo-950 shadow-2xl flex items-center justify-center">
            {activeMedia?.type === 'video' ? (
              getYouTubeEmbedUrl(activeMedia.url) ? (
                <iframe
                  src={getYouTubeEmbedUrl(activeMedia.url)!}
                  title={productTitle}
                  className="h-full w-full rounded-2xl border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={activeMedia.url}
                  controls
                  autoPlay
                  className="h-full w-full rounded-2xl object-cover bg-black"
                />
              )
            ) : (
              <>
                {mainImageUrl && (
                  <img
                    src={mainImageUrl}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20 blur-xl scale-110"
                  />
                )}
                {mainImageUrl && (
                  <img
                    src={mainImageUrl}
                    alt={productTitle}
                    className="relative z-10 h-full w-full object-contain p-2 transition-transform duration-300 hover:scale-[1.02]"
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
