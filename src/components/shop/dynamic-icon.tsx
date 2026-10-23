import {
  Baby, Backpack, BookOpen, Camera, Coffee, Dumbbell, Footprints, Gamepad2, Gift, Headphones, Laptop, Lamp, Package,
  Percent, Refrigerator, RotateCcw, Shirt, ShieldCheck, ShoppingBag, Smartphone, Sofa, Sparkles, Truck, Tv, Watch,
  Clock, CreditCard, BadgeCheck, Star, Heart, type LucideIcon,
} from 'lucide-react';

// Admin panelda tanlash mumkin bo'lgan ikonkalar
export const ICONS: Record<string, LucideIcon> = {
  smartphone: Smartphone, laptop: Laptop, headphones: Headphones, watch: Watch, shirt: Shirt, 'shopping-bag': ShoppingBag,
  footprints: Footprints, refrigerator: Refrigerator, coffee: Coffee, tv: Tv, sofa: Sofa, sparkles: Sparkles, baby: Baby,
  dumbbell: Dumbbell, 'book-open': BookOpen, 'gamepad-2': Gamepad2, lamp: Lamp, backpack: Backpack, camera: Camera,
  gift: Gift, truck: Truck, percent: Percent, 'shield-check': ShieldCheck, 'rotate-ccw': RotateCcw, clock: Clock,
  'credit-card': CreditCard, 'badge-check': BadgeCheck, star: Star, heart: Heart, package: Package,
};

export function DynamicIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && ICONS[name]) || Package;
  return <Icon className={className} aria-hidden />;
}
