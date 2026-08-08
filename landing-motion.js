(()=>{
  const reveals=[...document.querySelectorAll('[data-reveal]')];
  const phone=document.querySelector('.phone');
  const footer=document.querySelector('footer');
  const footerBrand=document.querySelector('.footer-brand');
  let loaded=false;
  let frame=0;
  const update=()=>{
    frame=0;
    const height=innerHeight;
    reveals.forEach(element=>{
      const box=element.getBoundingClientRect();
      if(box.top<height*.86&&box.bottom>height*.08)element.classList.add('is-visible');
    });
    if(phone&&!loaded){
      const box=phone.getBoundingClientRect();
      if(box.top<height*.78&&box.bottom>height*.2){
        loaded=true;
        setTimeout(()=>phone.classList.add('is-loaded'),720);
      }
    }
    if(footer&&footerBrand){
      const box=footer.getBoundingClientRect();
      footerBrand.classList.toggle('is-alive',box.top<height&&box.bottom>0);
    }
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)};
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  update();
})();
