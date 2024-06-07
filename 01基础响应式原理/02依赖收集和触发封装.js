// 1. 一个普通数据源
const data = {
  text: 'hello'
}

// 2. 一个副作用函数
function work(){
  document.body.innerHTML = data.text
}

// 3.1 一个收集依赖的数据结构（桶）
const bucket = new WeakMap()

// 3.2 一个代理对象
const obj = new Proxy(data, {
  get(target, key){

    if(!activeEffect) return target[key]

    track(target, key)

    return target[key]
  },

  set(target, key, newValue){
    target[key] = newValue

    trigger(target, key)

    return true
  }
})

// 4.1 一个记录当前的执行的副作用函数
let activeEffect

// 4.2 一种收集依赖的机制
function effect(fn){
  activeEffect = fn
  fn()
}

// 5.1 依赖收集函数
function track(target, key) {
  let depsMap = bucket.get(target)
  if(!depsMap){
    bucket.set(target, (depsMap = new Map()))
  }

  let deps = depsMap.get(key)
  if(!deps){
    depsMap.set(key, (deps = new Set()))
  }

  deps.add(activeEffect)
}

function trigger(target, key) {
  const depsMap = bucket.get(target)
  if(!depsMap) return

  const effects = depsMap.get(key)
  effects && effects.forEach( fn => fn())
}

effect(work)
obj.text = 'hello'