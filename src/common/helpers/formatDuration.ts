
export default function formatDuration(seconds) {
   seconds = Number(seconds);

   const weeks = Math.floor(seconds / (7 * 24 * 60 * 60));
   const days = Math.floor((seconds % (7 * 24 * 60 * 60)) / (24 * 60 * 60));
   const hours = Math.floor((seconds % (24 * 60 * 60)) / 3600);
   const minutes = Math.floor((seconds % 3600) / 60);
   const secs = seconds % 60;

   let parts: string[] = [];
   if (weeks) parts.push(`${weeks} week${weeks > 1 ? "s" : ""}`);
   if (days) parts.push(`${days} day${days > 1 ? "s" : ""}`);
   if (hours) parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
   if (minutes) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
   if (secs) parts.push(`${secs} second${secs > 1 ? "s" : ""}`);

   return parts.join(", ");
}