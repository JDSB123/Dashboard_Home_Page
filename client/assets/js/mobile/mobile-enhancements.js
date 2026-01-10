(function(){
  'use strict';
  
  function setupWeeklyLineupFab(){
    const fab = document.getElementById('mobile-fetch-fab');
    const menu = document.getElementById('mobile-fetch-menu');
    if(!fab || !menu) {
      console.log('Mobile FAB not found (expected on desktop)');
      return;
    }

    const closeMenu = () => {
      menu.setAttribute('hidden','');
      fab.setAttribute('aria-expanded','false');
    };
    const openMenu = () => {
      menu.removeAttribute('hidden');
      fab.setAttribute('aria-expanded','true');
    };

    fab.addEventListener('click',(e)=>{
      e.stopPropagation();
      if(menu.hasAttribute('hidden')) openMenu(); else closeMenu();
    });

    document.addEventListener('click',(e)=>{
      if(!menu.hasAttribute('hidden')){
        const within = menu.contains(e.target) || fab.contains(e.target);
        if(!within) closeMenu();
      }
    });

    document.addEventListener('keydown',(e)=>{
      if(e.key === 'Escape') closeMenu();
    });

    menu.querySelectorAll('.fab-item').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const code = (btn.getAttribute('data-fetch')||'').toLowerCase();
        let target;
        if(code === 'all') {
          target = document.querySelector('.ft-fetch-all, [data-fetch="all"]');
        } else {
          target = document.querySelector(`.ft-fetch-league-btn[data-fetch="${code}"], button[data-fetch="${code}"]`);
        }
        if(target){
          console.log('Triggering fetch for:', code);
          target.click();
        } else {
          console.warn('Fetch control not found for:', code);
        }
        closeMenu();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    const body = document.body;
    if(body && body.classList.contains('page-weekly-lineup')){
      setupWeeklyLineupFab();
    }
  });
})();
