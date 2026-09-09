// eventConfig.js
// Single-source event configuration for the Fairy Birthday Invitation site.
// This module defines the EventConfig structure only (see design.md, Model 1).
// Field-level validation is implemented separately in task 2.2 — do not add
// validation logic here.
//
// Requirements: 6.1

/**
 * EventConfig
 *
 * childName    {String}        Name of the birthday child, shown in the headline
 *                               and throughout the invitation copy.
 * age          {Integer}       The birthday age being celebrated (e.g. 7).
 * eventDate    {String|Date}   The calendar date of the event. Rendered exactly
 *                               as authored, with no timezone conversion.
 * eventTime    {String}        The time of the event, rendered exactly as
 *                               authored (e.g. "2:00 PM"), with no timezone
 *                               conversion.
 * venueName    {String}        Name of the venue (e.g. "Willow Park Pavilion").
 * venueAddress {String}        Physical address of the venue.
 * mapLink      {String}        Optional "how to get there" link (e.g. a maps
 *                               URL). Omit or leave empty when not available.
 * rsvpContact  {String}        How guests should RSVP (name, phone, email, etc).
 * themeNote    {String}        Short note about the fairy theme / dress-up ask.
 * giftNote     {String}        Optional note about gifts. Omit or leave empty
 *                               when not applicable.
 * rsvpLink     {String}        Optional external RSVP link (e.g. a lu.ma
 *                               event URL). Omit or leave empty to keep the
 *                               no-backend contact-info reveal behavior.
 * rsvpEmbedUrl {String}        The Luma event embed URL, rendered as an
 *                               iframe in the RSVP section.
 * message      {String}        Optional closing message shown in the Closing
 *                               section (at most 280 characters).
 * themeColors  {String[]}      Fairy theme color palette, as hex color strings.
 * entourage    {Array<{role: string, members: string[]}>}
 *                               Optional list of entourage role groups (e.g.
 *                               "7 Roses", "7 Candles"), each with its member
 *                               names, shown in the Entourage section. Omit
 *                               when there is no entourage to display.
 */
export const EventConfig = {
  childName: 'Summer',
  age: 7,
  eventDate: '2026-10-03',
  eventTime: '3:00 PM',
  venueName: 'Villa Crisostomo Resort',
  venueAddress: 'Mangga, Candaba, Pampanga',
  mapLink: 'https://www.google.com/maps/search/?api=1&query=Villa+Crisostomo+Resort+Mangga+Candaba+Pampanga',
  rsvpContact: 'Text Aunt Mia at (555) 012-3456 by Aug 1',
  themeNote: 'Dress code: pastel colors only — soft pinks, lavenders, and blush tones. Fairy wings welcome!',
  giftNote: 'If you\'d like to bring a gift, monetary gifts are welcome, or anything pink — it\'s Summer\'s favorite color! 🎁💗',
  rsvpLink: '',
  rsvpEmbedUrl: 'https://luma.com/embed/event/evt-LPGF6QXWH6FAvjd/simple',
  message: 'Thank you for helping us celebrate Summer. See you in the enchanted garden!',
  themeColors: ['#FFDCE8', '#DCCBFF', '#FCEEF4', '#FFFDFB', '#D4AF37'],
  entourage: [
    { role: '7 Roses', members: ['Lolo Ernesto Flores', 'Lolo Marlon Buco', 'Uncle Byrron Flores', 'Uncle Borrys Flores', 'Tito James Baltazar', 'Tito Aeron Buco', 'Daddy JM Buco'] },
    { role: '7 Candles', members: ['Mama Merry Flores', 'Lola Michelle Baltazar', 'Lola Elizabeth Buco', 'Lola Marissa Manzano', 'Lola Marian Mallari', 'Auntie Jane Desiree Adarme', 'Mommy Lala Buco'] },
    { role: '7 Blind Box', members: ['Atheia Mindy Manabat', 'Duchess Helena Mariano', 'Ate Elisha Kaleigh Ase', 'Ate Athena Cruz', 'Kara Sofia Tapang', 'Keilee Lerica Antonio', 'Malory Khane Roque'] },
    { role: '7 Shoes', members: ['Madison Khane Roque', 'Xenobia Capulong', 'Regina Claire Ibe', 'Bella Sophie Buco', 'Addyson Sagum', 'Zoe Aaliyah Maglanque', 'Kelly Adeline'] },
    { role: '7 Wishes', members: ['Ninang Karina Ase', 'Ninang Bea Mallari', 'Ninang Danica Gail Sebastian', 'Ninang Jamaica Maglanque', 'Ninang Jhona Flores', 'Ninang Ma Angelica Bautista', 'Ninang Precious Emocling'] },
    { role: '7 Pajamas', members: ['Ninang Mykah Gayle Dela Cruz', 'Ninang Princess Maniaul', 'Ninang Lyka Manalili', 'Ninang Veronica Santiago', 'Tita Hazel Anne Cruz', 'Tita Joey Manzano', 'Tita Charlly Mae Manzano'] },
  ],
};

export default EventConfig;
