import React, { memo } from 'react';
import * as Lucide from 'lucide-react-native';

import { palette } from '@theme/colors';
import { s } from '@theme/metrics';

/**
 * Single icon entry point for the app.
 *
 * `admin-mobile-app.html` renders every icon through Lucide
 * (`<i data-lucide="truck">` + `lucide.createIcons()`), so `lucide-react-native`
 * draws the exact same vector paths. The stylesheet's
 * `[data-lucide] { stroke-width:2 }` is mirrored by the default below.
 */
export type IconName = keyof typeof iconMap;

const iconMap = {
  activity: Lucide.Activity,
  'alert-circle': Lucide.AlertCircle,
  'alert-triangle': Lucide.AlertTriangle,
  'arrow-right': Lucide.ArrowRight,
  'badge-check': Lucide.BadgeCheck,
  'battery-full': Lucide.BatteryFull,
  bell: Lucide.Bell,
  'bell-ring': Lucide.BellRing,
  'building-2': Lucide.Building2,
  'calendar-days': Lucide.CalendarDays,
  camera: Lucide.Camera,
  check: Lucide.Check,
  'check-circle-2': Lucide.CheckCircle2,
  'chevron-down': Lucide.ChevronDown,
  'chevron-left': Lucide.ChevronLeft,
  'chevron-right': Lucide.ChevronRight,
  'clipboard-check': Lucide.ClipboardCheck,
  'clipboard-list': Lucide.ClipboardList,
  'credit-card': Lucide.CreditCard,
  crown: Lucide.Crown,
  download: Lucide.Download,
  'edit-3': Lucide.Edit3,
  expand: Lucide.Expand,
  eye: Lucide.Eye,
  'file-check': Lucide.FileCheck,
  'file-text': Lucide.FileText,
  fingerprint: Lucide.Fingerprint,
  flag: Lucide.Flag,
  'folder-archive': Lucide.FolderArchive,
  headphones: Lucide.Headphones,
  home: Lucide.Home,
  'id-card': Lucide.IdCard,
  image: Lucide.Image,
  'layout-dashboard': Lucide.LayoutDashboard,
  leaf: Lucide.Leaf,
  'locate-fixed': Lucide.LocateFixed,
  lock: Lucide.Lock,
  'log-in': Lucide.LogIn,
  'log-out': Lucide.LogOut,
  'map-pin': Lucide.MapPin,
  menu: Lucide.Menu,
  'message-square-text': Lucide.MessageSquareText,
  navigation: Lucide.Navigation,
  'package-check': Lucide.PackageCheck,
  'package-plus': Lucide.PackagePlus,
  'package-search': Lucide.PackageSearch,
  'parking-circle': Lucide.ParkingCircle,
  phone: Lucide.Phone,
  play: Lucide.Play,
  plus: Lucide.Plus,
  'plus-circle': Lucide.PlusCircle,
  'qr-code': Lucide.QrCode,
  receipt: Lucide.Receipt,
  'scroll-text': Lucide.ScrollText,
  search: Lucide.Search,
  send: Lucide.Send,
  'share-2': Lucide.Share2,
  shield: Lucide.Shield,
  'shield-check': Lucide.ShieldCheck,
  signal: Lucide.Signal,
  smartphone: Lucide.Smartphone,
  truck: Lucide.Truck,
  upload: Lucide.Upload,
  'upload-cloud': Lucide.UploadCloud,
  user: Lucide.User,
  'user-check': Lucide.UserCheck,
  'user-cog': Lucide.UserCog,
  'user-plus': Lucide.UserPlus,
  users: Lucide.Users,
  warehouse: Lucide.Warehouse,
  wifi: Lucide.Wifi,
  'wifi-off': Lucide.WifiOff,
  x: Lucide.X,
} as const;

export type IconProps = {
  name: IconName;
  /** CSS px on the 310pt design canvas — scaled to the device automatically. */
  size?: number;
  color?: string;
  /** `stroke-width` from the HTML. Defaults to the global `2`. */
  strokeWidth?: number;
  /** Lucide's `fill` (only `star` uses it in the reference). */
  fill?: string;
};

const IconComponent: React.FC<IconProps> = ({
  name,
  size = 16,
  color = palette.navy,
  strokeWidth = 2,
  fill = 'none',
}) => {
  const Glyph = iconMap[name];
  if (!Glyph) {
    return null;
  }
  return <Glyph size={s(size)} color={color} strokeWidth={strokeWidth} fill={fill} />;
};

export const Icon = memo(IconComponent);
Icon.displayName = 'Icon';
