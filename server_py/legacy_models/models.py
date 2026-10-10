"""
Modelos reflejados de la base de datos PostgreSQL gestionada por Prisma ORM.
IMPORTANTE: Todos los modelos tienen 'managed = False'.
Django NUNCA ejecuta migraciones ni altera estas tablas para evitar colisiones con Prisma.
"""
from django.db import models


class Usuario(models.Model):
    id = models.CharField(max_length=32, primary_key=True)
    nombre = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)
    rol = models.CharField(max_length=20)
    cargo = models.CharField(max_length=100, null=True, blank=True)
    telefono = models.CharField(max_length=50, null=True, blank=True)
    establecimiento = models.CharField(max_length=150, null=True, blank=True)
    fecha_registro = models.DateTimeField(db_column="fechaRegistro")

    class Meta:
        managed = False
        db_table = "usuarios"

    def __str__(self):
        return f"{self.nombre} ({self.rol})"


class Potrero(models.Model):
    id = models.CharField(max_length=32, primary_key=True)
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(null=True, blank=True)
    superficie_has = models.FloatField(db_column="superficieHas", null=True, blank=True)
    capacidad = models.IntegerField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "potreros"

    def __str__(self):
        return self.nombre


class Ganado(models.Model):
    id = models.CharField(max_length=32, primary_key=True)
    caravana = models.CharField(max_length=50, unique=True)
    categoria = models.CharField(max_length=50)
    raza = models.CharField(max_length=50)
    sexo = models.CharField(max_length=20)
    peso_kg = models.FloatField(db_column="pesoKg")
    estado_sanitario = models.CharField(max_length=50, db_column="estadoSanitario")
    fecha_nacimiento = models.DateTimeField(db_column="fechaNacimiento", null=True, blank=True)
    fecha_registro = models.DateTimeField(db_column="fechaRegistro")
    potrero_id = models.CharField(max_length=32, db_column="potreroId", null=True, blank=True)

    class Meta:
        managed = False
        db_table = "ganado"

    def __str__(self):
        return f"{self.caravana} - {self.categoria} ({self.peso_kg} kg)"


class SanidadEvento(models.Model):
    id = models.CharField(max_length=32, primary_key=True)
    evento = models.CharField(max_length=150)
    tipo = models.CharField(max_length=50)
    lote = models.CharField(max_length=100, null=True, blank=True)
    fecha_programada = models.DateTimeField(db_column="fechaProgramada")
    estado = models.CharField(max_length=50)
    prioridad = models.CharField(max_length=50)
    icono = models.CharField(max_length=50, null=True, blank=True)
    notas = models.TextField(null=True, blank=True)
    fecha_registro = models.DateTimeField(db_column="fechaRegistro")
    ganado_id = models.CharField(max_length=32, db_column="ganadoId", null=True, blank=True)
    responsable_id = models.CharField(max_length=32, db_column="responsableId", null=True, blank=True)

    class Meta:
        managed = False
        db_table = "sanidad_eventos"

    def __str__(self):
        return f"{self.evento} ({self.estado})"


class Insumo(models.Model):
    id = models.CharField(max_length=32, primary_key=True)
    nombre = models.CharField(max_length=150)
    categoria = models.CharField(max_length=50)
    stock_actual = models.FloatField(db_column="stockActual")
    stock_minimo = models.FloatField(db_column="stockMinimo")
    unidad = models.CharField(max_length=30)
    ubicacion = models.CharField(max_length=100)
    estado = models.CharField(max_length=50)
    requiere_reposicion = models.BooleanField(db_column="requiereReposicion")
    icono = models.CharField(max_length=50, null=True, blank=True)
    fecha_registro = models.DateTimeField(db_column="fechaRegistro")

    class Meta:
        managed = False
        db_table = "insumos"

    def __str__(self):
        return f"{self.nombre} (Stock: {self.stock_actual} {self.unidad})"


class ParteDiario(models.Model):
    id = models.CharField(max_length=32, primary_key=True)
    fecha = models.DateTimeField()
    novedades = models.TextField()
    animales_revisados = models.IntegerField(db_column="animalesRevisados")
    solicitud_insumos = models.TextField(db_column="solicitudInsumos", null=True, blank=True)
    estado = models.CharField(max_length=30)
    fecha_carga = models.DateTimeField(db_column="fechaCarga")
    fecha_revision = models.DateTimeField(db_column="fechaRevision", null=True, blank=True)
    peon_id = models.CharField(max_length=32, db_column="peonId")
    revisado_por_id = models.CharField(max_length=32, db_column="revisadoPorId", null=True, blank=True)
    potrero_id = models.CharField(max_length=32, db_column="potreroId", null=True, blank=True)

    class Meta:
        managed = False
        db_table = "partes_diarios"

    def __str__(self):
        return f"Parte {self.id} - {self.estado}"
