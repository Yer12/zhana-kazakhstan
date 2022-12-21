// Opera doesn't implement Date.now
if (!Date.now) {
  Date.now = function() {
    return Number(new Date);
  };
}

Canabalt = function(container, options) {
  this.options = options || {};
  this.container = container;
  this.viewportWidth = this.container.offsetWidth;
  this.buildings = [];
  this.resultModal = document.getElementById('myModal');
  this.personModal = document.getElementById('personModal');
  this.score = document.getElementById('score');
  // Milliseconds between frames
  this.mbf = 1500 / this.readOption('fps');
  
  this.initialize();
};

// Cap game at 90 cycles per second
Canabalt.CYCLES_PER_SECOND = 90;

// Map keys bound to jump action
Canabalt.BIND_JUMP_KEYS = {'88': true, '67': true, '32': true}; // X, C, spacebar

Canabalt.DISTANCE_TO_METERS_COEFFICIENT = 0.055;

Canabalt.PARALAX_BG_1_SPEED = 0.3;

Canabalt.PARALAX_BG_2_SPEED = 0.2;

Canabalt.CLOUD_OFFSET = '50px';
Canabalt.CLOUD_SPEED = 0.15;
Canabalt.CHARACTER = 0;
Canabalt.PARALAX_FG_SPEED = 3;
Canabalt.PARALAX_FG_INITIAL_WAIT = 3000;

if(window.outerWidth < 575) {
    Canabalt.PARALAX_BG_1_TOP_OFFSET = '100px';
    Canabalt.PARALAX_BG_2_TOP_OFFSET = '-35px';
  
    Canabalt.RUNNER_WIDTH = 174;
    Canabalt.RUNNER_HEIGHT = 178;
}
else {
    Canabalt.PARALAX_BG_1_TOP_OFFSET = '80px';
    Canabalt.PARALAX_BG_2_TOP_OFFSET = '-40px';

    Canabalt.RUNNER_WIDTH = 24;
    Canabalt.RUNNER_HEIGHT = 38;
}

Canabalt.RUNNER_JUMPING_WIDTH = 28;
Canabalt.RUNNER_FALLING_ANIMATION_FREQ = 6; // Change falling frame every n cycles

Canabalt.RUNNER_X_OFFSET_COEFFICIENT = 100;
Canabalt.RUNNER_RUNNING_FRAMECOUNT = 16;
Canabalt.RUNNER_RUNNING_CHANGE_FRAME_DISTANCE = 15;

Canabalt.defaultOptions = {
  fps: 50,
  initialSpeed: 0.2,
  acceleration: 0.0001,
  jumpImpulse: 5.5,
  gravity: 0.15
};

Canabalt.prototype.readOption = function(option) {
  return this.options[option] || Canabalt.defaultOptions[option];
};

const selectCharacter = (char) => {
   document.getElementById('resImg').src = "img/modal-img" + char + ".png"
  this.Canabalt.CHARACTER = char;
  document.getElementById('personModal').style.display = 'none';
  game.start();
  this.game.initialize();
}

Canabalt.prototype.initialize = function() {
  // Reset cycle counter
  this.cycles = 0;


  // Reset speed and traveled distance
  this.speed = this.readOption('initialSpeed');
  this.distance = 0;

  
  // Runner variables
  this.airborne = false;
  this.jumping = false;
  this.ySpeed = 0;
  this.y = 300;
  if(window.outerWidth < 575) {
      this.y = 200;
  }
  else {
      this.y = 300;
  }

  // Copy some options to object space for quicker access
  this.acceleration = this.readOption('acceleration');
  this.jumpImpulse = this.readOption('jumpImpulse');
  this.gravity = this.readOption('gravity');

  // Pointer to the building the runner is currently "stepping" on
  this.currentBuilding = null;

  // Create runner DIV
  if (!this.runner) {
    this.runner = this.createDiv('runner');
    const animationPlayer = bodymovin.loadAnimation({
      container: this.runner,
      path: 'img/char'+window.Canabalt.CHARACTER+'.json',
      render: 'svg',
      loop: true,
      autoplay: true,
      name: 'player animation'
    })
    animationPlayer.play();
  }
  else {
    this.runner.remove();
    this.runner = this.createDiv('runner');
    const animationPlayer = bodymovin.loadAnimation({
      container: this.runner,
      path: 'img/char'+window.Canabalt.CHARACTER+'.json',
      render: 'svg',
      loop: true,
      autoplay: true,
      name: 'player animation'
    })
    animationPlayer.play();
    
  }

  this.runner.classList.remove('die')

  this.runnerFrame = 0;
  this.runnerRunAnimationDistance = 0;

  // First paralax background
  if (!this.paralaxBg1) {
    this.paralaxBg1 = this.createDiv('paralaxbg1');
  }
  this.paralaxBg1Offset = 0;

  // Second paralax background
  if (!this.paralaxBg2) {
    this.paralaxBg2 = this.createDiv('paralaxbg2');
  }
  this.paralaxBg2Offset = 0;

  // Cloud
  if (!this.cloud) {
      this.cloud = this.createDiv('cloud');
  }
  this.cloudOffset = 0;

  this.removeParalaxBeam();
  this.scheduleParalaxBeam(Canabalt.PARALAX_FG_INITIAL_WAIT);

  // Distance counter
  if (!this.distanceCounter) {
    this.distanceCounter = this.createDiv('distance');
  }

  // Remove all buildings
  while (this.buildings.length) this.removeFirstBuilding();

  // Place the first building
  this.addBuilding(new Canabalt.DD(this));


    // Provide the viewport with an actual height property so that
  // absolute elements within it are positioned relative to its height
  // rather than its ancestor container
  this.container.style.height = String(this.container.offsetHeight) + 'px';

  return this;
};

Canabalt.prototype.createDiv = function(className, skipInsert) {
  var div = document.createElement('div');
  div.className = className;
  if (!skipInsert) this.container.appendChild(div);
  return div;
};

Canabalt.prototype.paused = function() {
  return !this.interval;
};

Canabalt.prototype.start = function() {
  if (this.paused()) {
    // Initialize cycle clock and timer
    this.lastCycle = Date.now();
    this.elapsed = 0;

    this.startInputCapture();

    // Create game interval
    var me = this;
    this.interval = setInterval(function() { me.cycle(); }, 1000 / Canabalt.CYCLES_PER_SECOND);
  }
  return this;
};

// PAUSE
Canabalt.prototype.stop = function() {
  if (!this.paused()) {
    this.stopInputCapture();

    // Stop game interval
    clearInterval(this.interval);
    delete this.interval;
  }
  return this;
};
Canabalt.prototype.addBuilding = function(building) {
  this.buildings.unshift(building);
  this.container.appendChild(building.element);
};

Canabalt.prototype.removeFirstBuilding = function() {
  var building = this.buildings.pop();
  this.container.removeChild(building.element);
};


Canabalt.prototype.startInputCapture = function() {
  var me = this;

  this.oldOnKeyDown = document.onkeydown;
  this.oldOnKeyUp = document.onkeyup;

  // Use DOM-0-style event listener registration
  // for easier cross-browser compatibility
  // No need for anything fancy anyway

  document.onkeydown = function(event) {  
    if (Canabalt.BIND_JUMP_KEYS[String(event.keyCode)]) {
      me.startJump();
    }
  };

  document.onkeyup = function(event) {
    if (Canabalt.BIND_JUMP_KEYS[String(event.keyCode)]) {
      me.endJump();
    }
  };

  if(window.outerWidth < 975) {
    document.addEventListener('touchstart', function(e){
      document.onkeydown({keyCode: 32});
    })
    document.addEventListener("touchend", function(e) {
      document.onkeyup({ keyCode: 32 });
    });
  }
};

Canabalt.prototype.stopInputCapture = function() {
  document.onkeydown = this.oldOnKeyDown;
  document.onkeyup = this.oldOnKeyUp;
};

Canabalt.prototype.startJump = function() {
  if (!this.airborne && !this.jumping) {
    this.airborne = true;
    this.jumping = true;
    this.ySpeed = this.jumpImpulse;
  }
};

Canabalt.prototype.endJump = function() {
  if (this.airborne && this.jumping) {
    this.jumping = false;
    if (this.ySpeed > 0) this.ySpeed = 0;
  } else if (this.jumping) {
    this.jumping = false;
  }
};

Canabalt.prototype.scheduleParalaxBeam = function(wait) {
  var me = this;
  this.paralaxBeamTimeout = setTimeout(function() { me.spawnParalaxBeam(); }, wait);
};

Canabalt.prototype.spawnParalaxBeam = function() {
  // Choose one of two possible beam styles
  var style = Math.round(1 + Math.random());

  this.paralaxBeam = this.createDiv('paralaxbeam' + style, true);
  this.paralaxBeamOffset = this.viewportWidth;
  this.paralaxBeam.style.left = this.paralaxBeamOffset + 'px';

  // Insert paralax element
  this.container.appendChild(this.paralaxBeam);

  // Now obtain its width
  this.paralaxBeamWidth = this.paralaxBeam.offsetWidth;
};

Canabalt.prototype.removeParalaxBeam = function() {
  if (this.paralaxBeam) {
    this.container.removeChild(this.paralaxBeam);
  }

  if (this.paralaxBeamTimeout) {
    clearTimeout(this.paralaxBeamTimeout);
  }

  this.paralaxBeam = null;
  this.paralaxBeamWidth = null;
  this.paralaxBeamOffset = null;
  this.paralaxBeamTimeout = null;
};

// In order to prevent setting the top offset of the viewport in each
// frame in which there is no shaking, this is a separate method from draw()
// and only called when the shaking stops
Canabalt.prototype.staightenViewport = function() {
  this.container.style.top = null;
};

Canabalt.prototype.draw = function() {
  // Draw buildings
  for (var i = 0; i < this.buildings.length; ++i) {
    this.buildings[i].draw();
  }
  // Draw runner
  this.runner.style.bottom = String(Math.round(this.y)) + 'px';
  this.runner.style.left = String(Math.round(this.x)) + 'px';

  // NOTE: it kinda sucks that we're changing the guy's width for every frame here...
  if (this.airborne) {
    this.runner.style.width = String(Canabalt.RUNNER_JUMPING_WIDTH) + 'px';
  } else {
    this.runner.style.width = String(Canabalt.RUNNER_WIDTH) + 'px';
  }

  // Draw paralax
  this.paralaxBg1.style.backgroundPosition = String(Math.round(this.paralaxBg1Offset)) + 'px ' + Canabalt.PARALAX_BG_1_TOP_OFFSET;
  this.paralaxBg2.style.backgroundPosition = String(Math.round(this.paralaxBg2Offset)) + 'px ' + Canabalt.PARALAX_BG_2_TOP_OFFSET;
  this.cloud.style.backgroundPosition = String(Math.round(this.cloudOffset)) + 'px ' + Canabalt.CLOUD_OFFSET;

  if (this.paralaxBeam) {
    this.paralaxBeam.style.left = String(Math.round(this.paralaxBeamOffset)) + 'px';
  }

  // Draw distance counter
  this.distanceCounter.innerHTML = String(Math.round(this.distance * Canabalt.DISTANCE_TO_METERS_COEFFICIENT)) + 'm';

};

// This is where most the game logic happens
Canabalt.prototype.cycle = function() {
  // Increment cycles counter
  this.cycles++;

  // Calculate time elapsed since last game cycle
  var elapsed = Date.now() - this.lastCycle;

  // Keep track of time elapsed since last frame
  this.elapsed += elapsed;

  // Calculate how much we moved this cycle
  var distance = Math.round(elapsed * this.speed);

  // Increment the total distance ran
  this.distance += distance;

  // Increase speed
  this.speed += this.acceleration;

  // Runner's x offset is square root of the speed times a multiplier
  this.x = Math.sqrt(this.speed) * Canabalt.RUNNER_X_OFFSET_COEFFICIENT;

  // Check jump
  if (this.airborne) {
    // Calculate which jumping frame to display based on
    // vertical speed
    if (this.ySpeed > this.jumpImpulse * 0.66) {
      this.runnerFrame = 0;
    } else if (this.ySpeed > this.jumpImpulse * 0.33) {
      this.runnerFrame = 1;
    } else if (this.ySpeed > this.jumpImpulse * 0.1) {
      this.runnerFrame = 2;
    } else if (!this.falling && this.ySpeed <= 0) {
      this.falling = true;
      this.runnerFrame = 3;
    } else if (this.cycles % Canabalt.RUNNER_FALLING_ANIMATION_FREQ == 0) {
      this.runnerFrame++;
      if (this.runnerFrame == 11) this.runnerFrame = 3;
    }

    this.y += this.ySpeed;
    this.ySpeed -= this.gravity;
  
    var h = this.currentBuilding ? this.currentBuilding.height : 0;
    if (this.y < h) {
        if(h - this.y > 10) {
            game.stop();
            this.runner.classList.add('die');
            this.score.innerHTML = this.distanceCounter.innerHTML.slice(0, -1);
            if(localStorage.getItem('lrt_game_score')) {
              if(+localStorage.getItem('lrt_game_score') < +this.score.innerHTML) {

                localStorage.setItem('lrt_game_score', this.score.innerHTML)
                let payload =
                    {
                      phone: localStorage.getItem('lrt_game_phone'),
                      come_from: "zhana-kazakhstan",
                      nickname: localStorage.getItem('lrt_game_nickname'),
                      score: parseInt(this.score.innerHTML)
                    }

                fetch('https://api.dev.1fit.app/api/landing/v1/leads/get-trial/', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json;charset=utf-8'
                  },
                  body: JSON.stringify(payload)
                })
                    .then((resp) => {
                      console.log(resp);
                    })
                    .catch((error) => {
                      console.log(error);
                    });
              }
              else {
                console.log(localStorage.getItem('lrt_game_score'), this.score.innerHTML, localStorage.getItem('lrt_game_score') < this.score.innerHTML);
              }
            }
            else {
              console.log('score not have');
            }
            const lowResults = {
              "ru": [
                'Алматы смог, а ты нет 🤷🏻‍♂️',
                'За такой результат мы бы тебе повысили цену за аренду квартиры',
                'Тебе точно нужен город без заборов, потому что прыгаешь ты так себе',
                'В новом Казахстане таких как ты сбрасывают с Байтерека',
                'Хотим развидеть твой результат, как реакцию Нуртаса на Баззлайтера',
                'Результат маленький, зато у него богатый внутренний мир',
                'С тобой Новый Казахстан мы вряд ли построим 😕',
                'Падаешь как тенге',
                'Чето ты тормозишь, инет блочат?',
                'Все эти пробки по Аль-Фараби из-за тебя, тормоз',
                'Бокс тебе точно не помешает, реакцию прокачать',
                'Скачешь неуклюже, как цены на уан фит',
                'Упал, как вывеска с Нур-Султаном',
                'Приземлился, как репутация Рамиля',
                'Ну ты [зацензурено] 🤮',
                'У тебя появляются новые нейронные связи, как станции метро в Алматы. Также медленно',
              ],
              "kz": [
                'Нәтижең Алматының түтінінде қалып кеткендей, дым көрінбейді 🤷🏻‍♂️',
                'Мұндай нәтиже үшін біз саған пәтердің ақысын көтеретін едік',
                'Саған қоршаусыз қала керек екеніне көз жеткіздік, онша секіре алмайсың',
                'Жаңа Қазақстанда сен сияқтыларды Байтеректен тастайды',
                'Сенің нәтижеңді Нұртастың Баззлайтерға көрсеткен реакциясы сияқты ұмытқымыз келеді',
                'Нәтижең кішкентай болғанымен, оның ішкі байлығы барына сенімдіміз',
                'Жаңа Қазақстанды сенімен бірге құрастыра алмаймыз-ау 😕',
                'Теңге сияқты түсіп бара жатырсың',
                'Жылдамдығың дәл интернеттікіндей',
                'Әл-Фарабидағы кептеліс сенің кесіріңнен, еш асықпайтын адам екенсің',
                'Реакцияңды жақсарту үшін боксқа барып көрші',
                'Уан фиттің бағалары сияқты епсіздеу секіресің',
                'Нұр-Сұлтандағы маңдайша жазуы сияқты құладың ғой',
                'Рамильдің атағы сияқты жерге түстің ғой',
                'Ай сені ме… [жаман сөз] 🤮',
                'Сендегі жаңа нейрондық байланыстар дәл Алматы метросындағы станциялар сияқты. Дәл солай асықпайсың',
              ]
            }
            const mediumResults = {
              "ru": [
                'Давай, скажи ещё, что кибератаки тебе помешали нормально сыграть',
                'Может, на массаж пора тебе? Пальчики размять',
                'С твоими шансами тебе прямая дорога на выборы Президента',
                'Попей кумыса, сделай пару отжиманий и попробуй снова',
                'Мы бы тебя обняли, как Тореш Кайрата',
                'Не важно, какой прыжок. Главное — как ты им пользуешься',
                'Результат не маленький, просто в Астане холодно',
                'Пойдёт! А левая рука у тебя такая же сильная, как и правая?',
              ],
              "kz": [
                'Кибершабуылдан дұрыс ойнай алмай жатырмын демексің бе?',
                'Мүмкін, массажға барасың? Саусақтарыңа пайдалы болады',
                'Мұндай мүмкіндіктеріңмен Президенттік сайлауға түсіп көресің бе?',
                'Қымыз ішіп, бірнеше жаттығу жасап, тағы да ойнап көр',
                'Төреш Қайратты құшақтағандай біз де сені құшақтадық',
                'Қалай секіргенің маңызды емес, ең бастысы секіре аласың',
                'Нәтижең кішкентай емес, бұл тек Астананың суығының кесірінен',
                'Болады! Ал сенің сол қолың оң қолыңдай мықты ма?',
              ]
            }
            const hardResults = {
              "ru": [
                'Ты секси, как редизайн приложения уан фит 💙',
                '667 Бензема ⚽️',
                'У тебя результат такой же большой, как цены на недвижку в Казахстане ',
                'Сумасшедший результат, как сммщик Бисквита 🤯',
                'Настолько офигенный результат, что мы тебя бы сняли в рекламе уан фита',
                'Ты бы точно спас ребёнка, который повис с окна, красавчик! ',
                'Результат охуенчик ',
                'Воу, какой большой результат. Закинь его в тиндер 🤩',
                'Настолько быстрый, что тебе прилетит штраф от сергека',
                'Ты с Байконура? Прыжки просто космос 🧑‍🚀',
              ],
              "kz": [
                'Уан фит қосымшасының редизайны сияқты жағымдысың 💙',
                '667 Бензема ⚽️',
                'Нәтижең Қазақстандағы жылжымайтын мүліктің бағасы сияқты, аспандап тұр',
                'Нәтижең бисквиттің смм-жұмысшысы сияқты жынды екен 🤯',
                'Сондай керемет нәтиже көрсеттің! Сені уан фиттің жаңа жарнамасында түсірер едік',
                'Терезеден құлап түсейін деген баланың өмірін сақтап қалатын адам екенсің, жарайсың!',
                'Нәтижең ө-ө-өлә жынды екен!',
                'Мә, нәтижең қандай дәу! Тиндерға жариялап сал 🤩',
                'Сондай жылдамсың, сергек саған айыппұл жіберері анық',
                'Байқоңырдансың ба не? Секірулерің ғарыш қой 🧑‍🚀',
              ]
            }
            const modalTitle = document.getElementById('modal-text');
            const lang = localStorage.getItem('lang');
            console.log(lowResults[lang][0]);
            if(this.score.innerHTML <= 500) {
              modalTitle.innerText = lowResults[lang][Math.floor(Math.random() * lowResults[lang].length)]
            }
            else if(this.score.innerHTML <= 1000 && this.score.innerHTML > 500) {
              modalTitle.innerText = mediumResults[Math.floor(Math.random() * mediumResults[lang].length)]
            }
            else {
              modalTitle.innerText = hardResults[Math.floor(Math.random() * hardResults[lang].length)]
            }
            setTimeout(()=> {
              this.resultModal.style.display = "flex";
            }, 1000 );
        }
        else {
            this.y = h;
            this.ySpeed = 0;
            this.airborne = false;
            this.falling = false;
        }
    }

    if(this.y === 0) {
      game.stop();
      this.runner.classList.add('die');
      setTimeout(()=> {
        this.resultModal.style.display = "flex";
      }, 1000 );
    }
    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function(event) {
      if (event.target === this.game.resultModal) {
          this.game.resultModal.style.display = "none";
      }
    }
    window.onclick = function(event) {
      if (event.target === this.game.personModal) {
          this.game.personModal.style.display = "none";
          game.start();
      }
    }
  } else {

    this.runnerRunAnimationDistance += distance;

    // Set runner animation frame
    if (this.runnerRunAnimationDistance > Canabalt.RUNNER_RUNNING_CHANGE_FRAME_DISTANCE) {
      this.runnerRunAnimationDistance = 0;
      ++this.runnerFrame;
    }
  }

  // Move buildings
  for (var i = 0; i < this.buildings.length; ++i) {
    this.buildings[i].move(distance);
  }

  // Move paralax
  this.paralaxBg1Offset -= distance * Canabalt.PARALAX_BG_1_SPEED;
  this.paralaxBg2Offset -= distance * Canabalt.PARALAX_BG_2_SPEED;
  this.cloudOffset -= distance * Canabalt.CLOUD_SPEED;

  if (this.paralaxBeam) {
    this.paralaxBeamOffset -= distance * Canabalt.PARALAX_FG_SPEED;
    if (this.paralaxBeamOffset <= -this.paralaxBeamWidth) {
      this.removeParalaxBeam();
      this.scheduleParalaxBeam(Math.round(Math.random() * (5000 / this.speed)))
    }
  }


  // Check if we need to redraw
  if (this.elapsed > this.mbf) {
    this.elapsed = 0;
    this.draw();
  }

  this.lastCycle = Date.now();
};

function shuffle(array) {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {

    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}
let c = 0;
Canabalt.Building = function(game, options) {
  this.game = game;
  const wB = [
    863, 300, 603, 500,603,
    1200, 982, 860, 982,
    302, 982, 605, 501,
    600, 603, 982, 981,
    603, 301, 501, 
    1201,982, 
    501, 602, 861,
    862, 501, 1203, 983, 
    1204, 501, 303, 
    863, 604, 
    866, 603, 700,
  ];


  this.type = Canabalt.Building.TYPE_NORMAL;
    
  this.width = wB[c % wB.length];
  this.height = 200 + Math.round(Math.random() * 100);
  c++;
 
  this.gap = Math.round(this.game.speed * 300);
  this.totalWidth = this.width + this.gap;

  this.left = this.game.viewportWidth;

  this.endReached = false;
  this.expired = false;

  this.isIn = false;
  this.isOut = false;

  this.element = document.createElement('div');
  this.element.className = 'building';
  this.element.style.height = String(this.height) + 'px';
  this.element.style.width = String(this.width) + 'px';
  this.draw();
};
Canabalt.DD = function(game, options) {
    this.game = game;
    this.firstbuilding = true;
    this.type = Canabalt.Building.TYPE_NORMAL;

    if(window.outerWidth < 575) {
        this.width = this.game.viewportWidth + 200;
        this.height = 200;
    }
    else {
        this.width = this.game.viewportWidth - 100;
        this.height = 300;
    }
    this.gap = Math.round(this.game.speed * 300);
    this.totalWidth = this.width + this.gap;

    this.left = 0;

    this.endReached = false;
    this.expired = false;

    this.isIn = false;
    this.isOut = false;

    this.element = document.createElement('div');
    this.element.className = 'building';
    this.element.style.height = String(this.height) + 'px';
    this.element.style.width = String(this.width) + 'px';

    this.draw();
};


Canabalt.Building.TYPE_NORMAL= 1;
Canabalt.Building.TYPE_CRANE = 2;
Canabalt.Building.TYPE_DEMOLITION = 3;
Canabalt.Building.TYPE_INDOORS = 4;

Canabalt.Building.prototype.move = function(distance) {
  this.left -= distance;

  // Check if this is now the current building
  if (this.isIn) {
    if (!this.isOut && this.left + this.width < this.game.x) {
      this.game.currentBuilding = null;
      this.game.airborne = true;
      this.isOut = true;
    }
  } else if (this.left <= this.game.x) {
    this.game.currentBuilding = this;
    this.isIn = true;
  }

  // Check if the end of the building + gap was reached and call
  // an appropriate action (spawn a new building?)
  if (!this.endReached && (this.left + this.totalWidth <= this.game.viewportWidth)) {
    this.game.addBuilding(new Canabalt.Building(this.game));
    this.endReached = true;
  }

  // If the building leaves the left side of the screen then
  // it has expired and has to be removed
  if (!this.expired && (this.totalWidth + this.left <= 0)) {
    this.game.removeFirstBuilding();
    this.expired = true;
  }

  return this;
};
Canabalt.DD.prototype.move = function(distance) {
  this.left -= distance;

  // Check if this is now the current building
  if (this.isIn) {
    if (!this.isOut && this.left + this.width < this.game.x) {
      this.game.currentBuilding = null;
      this.game.airborne = true;
      this.isOut = true;
    }
  } else if (this.left <= this.game.x) {
    this.game.currentBuilding = this;
    this.isIn = true;
  }

  // Check if the end of the building + gap was reached and call
  // an appropriate action (spawn a new building?)
  if (!this.endReached && (this.left + this.totalWidth <= this.game.viewportWidth)) {
    this.game.addBuilding(new Canabalt.Building(this.game));
    this.endReached = true;
  }

  // If the building leaves the left side of the screen then
  // it has expired and has to be removed
  if (!this.expired && (this.totalWidth + this.left <= 0)) {
    this.game.removeFirstBuilding();
    this.expired = true;
  }

  return this;
};


function get_random (list) {
  let randomNum = Math.floor(Math.random() * list.length);

  return list[randomNum];
}


Canabalt.Building.prototype.draw = function() {
  if (!this.expired) {
    // 300
    if(this.element.offsetWidth === 300) {
      this.element.style.backgroundImage = 'url(img/buildings/b300_1.png)';
      this.element.style.backgroundSize = 'cover';
    }
    else if(this.element.offsetWidth === 301) {
      this.element.style.backgroundImage = 'url(img/buildings/b300_2.png)';
      this.element.style.backgroundSize = 'cover';
    }
    else if(this.element.offsetWidth === 302) {
      this.element.style.backgroundImage = 'url(img/buildings/b300_3.png)';
      this.element.style.backgroundSize = 'cover';
    }
    else if(this.element.offsetWidth === 303) {
      this.element.style.backgroundImage = 'url(img/buildings/b300_4.png)';
      this.element.style.backgroundSize = 'cover';
    }
    
    // 500
    else if(this.element.offsetWidth === 500) {
      this.element.style.backgroundImage = 'url(img/buildings/b500_1.png)';
    }
    else if(this.element.offsetWidth === 501) {
      this.element.style.backgroundImage = 'url(img/buildings/b500_2.png)';
    }
    //600 - 700
    else if(this.element.offsetWidth === 600) {
      this.element.style.backgroundImage = 'url(img/buildings/b600_1.png)';
    }
    else if(this.element.offsetWidth === 602) {
      this.element.style.backgroundImage = 'url(img/buildings/b600_2.png)';
    }
    else if(this.element.offsetWidth === 603) {
      this.element.style.backgroundImage = 'url(img/buildings/b600_3.png)';
    }
    else if(this.element.offsetWidth === 604) {
      this.element.style.backgroundImage = 'url(img/buildings/b600_4.png)';
    }
    else if(this.element.offsetWidth === 605) {
      this.element.style.backgroundImage = 'url(img/buildings/b600_5.png)';
    }
    //700 - 900
    else if(this.element.offsetWidth === 860) {
      this.element.style.backgroundImage = 'url(img/buildings/b866_1.png)';
    }
    else if(this.element.offsetWidth === 861) {
      this.element.style.backgroundImage = 'url(img/buildings/b866_2.png)';
      this.element.style.backgroundSize = 'cover';
    }
    else if(this.element.offsetWidth === 862) {
      this.element.style.backgroundImage = 'url(img/buildings/b866_3.png)';
      this.element.style.backgroundSize = 'cover';
    }
    else if(this.element.offsetWidth === 863) {
      this.element.style.backgroundImage = 'url(img/buildings/b866_4.png)';
      this.element.style.backgroundSize = 'cover';
    }
    else if(this.element.offsetWidth === 866) {
      this.element.style.backgroundImage = 'url(img/buildings/b866_5.png)';
      this.element.style.backgroundSize = 'cover';
    }
    // 900 - 1100
    else if(this.element.offsetWidth === 981) {
      this.element.style.backgroundImage = 'url(img/buildings/b981_1.png)';
    }
    else if(this.element.offsetWidth === 982) {
      this.element.style.backgroundImage = 'url(img/buildings/b981_2.png)';
    }
    else if(this.element.offsetWidth === 983) {
      this.element.style.backgroundImage = 'url(img/buildings/b981_3.png)';
    }
    // 1100 - 1300
    else if(this.element.offsetWidth === 1200) {
      this.element.style.backgroundImage = 'url(img/buildings/b1200_1.png)';
    }
    else if(this.element.offsetWidth === 1201) {
      this.element.style.backgroundImage = 'url(img/buildings/b1200_2.png)';
    }
    else if(this.element.offsetWidth === 1203) {
      this.element.style.backgroundImage = 'url(img/buildings/b1200_3.png)';
    }
    else if(this.element.offsetWidth === 1204) {
      this.element.style.backgroundImage = 'url(img/buildings/b1200_4.png)';
    }

    // else
    else {
      this.element.style.backgroundImage = 'url(img/buildings/building.png)';
    }
    this.element.style.left = String(this.left) + 'px';
  }
  else {
    console.log('new building');
  }
  return this;
};

Canabalt.DD.prototype.draw = function() {
    if (!this.expired) {
        this.element.style.backgroundImage = 'url(img/buildings/b1200_4.png)';
        this.element.style.backgroundSize = 'cover';

        this.element.style.left = String(this.left) + 'px';
    }
    return this;
};

