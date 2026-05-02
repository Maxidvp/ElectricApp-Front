export type Person = {
	firstName: string
	lastName: string
	age: number
	visits: number
	status: string
	progress: number
}

/*export type Circuito = {
	id: number
	tablero: string
	circuito: string
	tipo: string
	cantidad: number
	potencia: number
	longitud: number
	FP: number
	simultaneidad: number
	seccion: string
	formacion: string
}*/
export type Circuito = {
  circuito: string
  seccion: string
  formacion: string
  diametro: number
}

export type Cable = {
	seccion_f: number
	seccion_n: number
	seccion_t: number
	Nfases: number
	Nneutro: number
	Ntierra: number
	diametro?: number
	norma: string
	tension_nom?: number
	tension_aisl?: number
	modelo?: string
	proteccion?: number
	aislamiento?: string
	material?: string
	peso_metro?: number
	pantalla?: string
	blindaje?: string
}
