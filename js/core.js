// Environment flags shared by the other modules via window.PF.
window.PF = (function(){

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isChromium=(navigator.userAgentData&&navigator.userAgentData.brands&&navigator.userAgentData.brands.some(b=>/Chromium/i.test(b.brand)))||(/\bChrome\/|\bChromium\/|\bEdg\/|\bOPR\//.test(navigator.userAgent)&&!/\bEdgiOS|CriOS|FxiOS\b/.test(navigator.userAgent));

    return { reduce: reduce, isChromium: isChromium };
})();
