/**
 * Church leaders, migrated out of the website's hardcoded DEFAULT_PASTORS so
 * the roster lives in the database and can be edited from the admin.
 *
 * The image paths still point at the website's public/ folder, which is why
 * they resolve as-is. Re-uploading a leader's photo from the admin replaces
 * the path with an admin asset URL.
 */
export interface SeedPastor {
  id: string;
  name: string;
  role: string;
  facebook: string;
  image: string;
}

export const SEED_PASTORS: SeedPastor[] = [
  { id: '1', name: 'Zaldy Bernaldo', role: 'Pastor', facebook: 'https://www.facebook.com/zaldy.bernaldo.2025', image: 'Prayer Meeting/July21/july21-10.png' },
  { id: '2', name: 'Oliver Ricarpo', role: 'Associate Pastor', facebook: 'https://www.facebook.com/oliver.ricarpo', image: 'Prayer Meeting/July13/july13-3.png' },
  { id: '3', name: 'Jocelyn Ricarpo', role: 'Deacon', facebook: 'https://www.facebook.com/purokuno.stfrancis', image: 'Prayer Meeting/July6/july6-6.png' },
  { id: '4', name: 'Jericko Bernaldo', role: 'Guitarist', facebook: 'https://www.facebook.com/search/top?q=jericko%20bernaldo', image: '/leaders/pastor1.jpg' },
  { id: '5', name: 'Trixie Nacional', role: 'Bassist', facebook: 'https://www.facebook.com/trixie.nacional.5', image: '/leaders/pastor2.jpg' },
  { id: '6', name: 'Vianca Marie Hernandez', role: 'Worship Leader', facebook: 'https://www.facebook.com/profile.php?id=100086021530605', image: '/leaders/pastor3.jpg' },
  { id: '7', name: 'Trixie Mae Solano', role: 'Usherette', facebook: 'https://www.facebook.com/trixiemae.solano.56', image: '/leaders/pastor4.jpg' },
  { id: '8', name: 'Kirlly Pagara', role: 'Worship Leader', facebook: 'https://www.facebook.com/profile.php?id=61586061310680', image: '/leaders/pastor5.jpg' },
  { id: '9', name: 'Ramilyn Engracia', role: 'Announcer', facebook: 'https://www.facebook.com/ramramen.nissin', image: '/leaders/pastor6.jpg' },
  { id: '10', name: 'Ian Dela Cruz', role: 'Keyboardist', facebook: 'https://www.facebook.com/cmlvyannnn', image: '/leaders/pastor7.jpg' },
  { id: '11', name: 'Marvin Adlawan', role: 'Youth Leader', facebook: 'https://www.facebook.com/marvin.adlawan.48109', image: '/leaders/pastor8.jpg' },
  { id: '12', name: 'Reyman Boloso', role: 'Youth Leader', facebook: 'https://www.facebook.com/reyman.ireneaboloso', image: '/leaders/pastor13.jpg' },
  { id: '13', name: 'Reinz Baylon', role: 'Leader', facebook: 'https://www.facebook.com/reinz.baylon', image: '/leaders/pastor9.jpg' },
  { id: '14', name: 'Jeshurun Dy Ricarpo', role: 'Drummer', facebook: 'https://www.facebook.com/profile.php?id=61589678930945', image: '/leaders/pastor11.jpg' },
  { id: '15', name: 'Jedidiah Sy Ricarpo', role: 'Media', facebook: 'https://www.facebook.com/jedidiah.ricarpo', image: '/leaders/pastor12.jpg' }
];
