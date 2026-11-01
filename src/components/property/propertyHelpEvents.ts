/**
 * Shared names for the property page's phone Chat entry (PropertyMobileStickyBar), the
 * site-wide support drawer (SupportWidget) and the listing's own FAQ panel (GuestAssistant).
 * One module so none of the three has to import another one's component file.
 */

/** Window event: open the site-wide support drawer (WhatsApp / call / callback for the platform). */
export const OPEN_SUPPORT_EVENT = "atlas:open-support";

/** Window event: open THIS listing's own FAQ panel (questions the host answered for the listing). */
export const OPEN_LISTING_FAQ_EVENT = "atlas:open-listing-faq";

/** Body attribute that lets CSS hide the floaters (phones only) while the sticky bar is mounted. */
export const STICKY_CHAT_BODY_ATTR = "data-pp-sticky-chat";

/** Body attribute GuestAssistant sets while it has FAQs for the listing (its trigger exists). */
export const LISTING_FAQ_BODY_ATTR = "data-pp-listing-faq";

/** Body attribute set while the page footer is on screen close to the bottom-left floater stack. */
export const NEAR_FOOTER_BODY_ATTR = "data-pp-near-footer";

/**
 * CSS custom property on <body> holding the sticky bar's live height (0px when the bar is hidden
 * or not shown at this width). The support drawer lifts itself by it so the bar never covers it.
 */
export const STICKY_BAR_OFFSET_VAR = "--pp-sticky-bar-offset";

/** From the viewport bottom up to the top of the lowest floater at 1024px+ (see the CSS). */
export const FLOATER_STACK_CLEARANCE_PX = 84;
